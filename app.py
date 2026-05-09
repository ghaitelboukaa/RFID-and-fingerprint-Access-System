import os
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from flask_socketio import SocketIO
import sqlite3
import datetime
import jwt
from functools import wraps
import csv
import io

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'lafac_super_secret_key_2026'
socketio = SocketIO(app, cors_allowed_origins="*")

etat_systeme = {"mode": "NORMAL", "id_carte_attente": "", "id_basma_attente": "","id_a_supprimer": ""}

def init_db():
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS Utilisateurs (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, id_rfid TEXT, id_basma TEXT, statut TEXT, etat_presence TEXT DEFAULT 'OUT')''')
    c.execute('''CREATE TABLE IF NOT EXISTS Historique (id INTEGER PRIMARY KEY AUTOINCREMENT, id_utilise TEXT, nom_utilisateur TEXT, date_heure TEXT, resultat TEXT, type_acces TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS Admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS Config (id INTEGER PRIMARY KEY, heure_entree_debut TEXT, heure_entree_fin TEXT, heure_sortie_debut TEXT, heure_sortie_fin TEXT)''')
    
    # Default Admin
    c.execute("INSERT OR IGNORE INTO Admins (username, password) VALUES ('admin', 'admin123')")
    
    # Default Config (Always open by default)
    c.execute("INSERT OR IGNORE INTO Config (id, heure_entree_debut, heure_entree_fin, heure_sortie_debut, heure_sortie_fin) VALUES (1, '00:00', '23:59', '00:00', '23:59')")
    
    # Add new columns to existing tables if they don't exist (Migration)
    try:
        c.execute("ALTER TABLE Utilisateurs ADD COLUMN etat_presence TEXT DEFAULT 'OUT'")
    except sqlite3.OperationalError:
        pass # Column already exists
    try:
        c.execute("ALTER TABLE Historique ADD COLUMN type_acces TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists

    conn.commit()
    conn.close()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token manquant!'}), 401
        try:
            token = token.split(" ")[1] # Bearer <token>
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except Exception as e:
            return jsonify({'message': 'Token invalide!'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT * FROM Admins WHERE username=? AND password=?", (data.get('username'), data.get('password')))
    admin = c.fetchone()
    conn.close()
    
    if admin:
        token = jwt.encode({'user': admin[1], 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token})
    return jsonify({'message': 'Identifiants incorrects!'}), 401

@app.route('/api/config', methods=['GET', 'POST'])
@token_required
def gerer_config():
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    if request.method == 'GET':
        c.execute("SELECT heure_entree_debut, heure_entree_fin, heure_sortie_debut, heure_sortie_fin FROM Config WHERE id=1")
        row = c.fetchone()
        conn.close()
        return jsonify({"heure_entree_debut": row[0], "heure_entree_fin": row[1], "heure_sortie_debut": row[2], "heure_sortie_fin": row[3]})
    
    if request.method == 'POST':
        data = request.get_json()
        c.execute("UPDATE Config SET heure_entree_debut=?, heure_entree_fin=?, heure_sortie_debut=?, heure_sortie_fin=? WHERE id=1", 
                  (data.get('heure_entree_debut'), data.get('heure_entree_fin'), data.get('heure_sortie_debut'), data.get('heure_sortie_fin')))
        conn.commit()
        conn.close()
        socketio.emit('config_updated', data)
        return jsonify({"message": "Configuration mise à jour!"})

@app.route('/api/mode', methods=['GET', 'POST'])
def gerer_mode():
    global etat_systeme
    if request.method == 'POST':
        data = request.get_json()
        etat_systeme["mode"] = data.get("mode", "NORMAL")
        if etat_systeme["mode"] == "ENROLL_CARTE": etat_systeme["id_carte_attente"] = ""
        if etat_systeme["mode"] == "ENROLL_BASMA": etat_systeme["id_basma_attente"] = ""
        socketio.emit('mode_changed', etat_systeme)
    return jsonify(etat_systeme)

@app.route('/api/nouvel-id', methods=['POST'])
def recevoir_nouvel_id():
    global etat_systeme
    data = request.get_json()
    type_id = data.get("type")
    valeur_id = data.get("valeur")
    
    if type_id == 'CARTE': etat_systeme["id_carte_attente"] = valeur_id
    if type_id == 'BASMA': etat_systeme["id_basma_attente"] = valeur_id
    
    etat_systeme["mode"] = "NORMAL"
    socketio.emit('id_scanned', etat_systeme)
    return "OK", 200

def check_time_allowed(action, current_time_str):
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT heure_entree_debut, heure_entree_fin, heure_sortie_debut, heure_sortie_fin FROM Config WHERE id=1")
    cfg = c.fetchone()
    conn.close()
    
    curr_t = datetime.datetime.strptime(current_time_str, "%H:%M").time()
    
    if action == "ENTREE":
        start = datetime.datetime.strptime(cfg[0], "%H:%M").time()
        end = datetime.datetime.strptime(cfg[1], "%H:%M").time()
    else: # SORTIE
        start = datetime.datetime.strptime(cfg[2], "%H:%M").time()
        end = datetime.datetime.strptime(cfg[3], "%H:%M").time()
        
    if start <= end:
        return start <= curr_t <= end
    else: # Crosses midnight
        return start <= curr_t or curr_t <= end

@app.route('/api/verifier-carte', methods=['POST'])
def verifier_carte():
    data = request.get_json()
    id_recu = data.get('id_carte')
        
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT id, nom, etat_presence FROM Utilisateurs WHERE (id_rfid=? OR id_basma=?) AND statut='Actif'", (id_recu, id_recu))
    user = c.fetchone()
    
    now_dt = datetime.datetime.now()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    time_str = now_dt.strftime("%H:%M")
    
    if user:
        user_id, nom_user, etat_presence = user
        action = "ENTREE" if etat_presence == "OUT" else "SORTIE"
        new_presence = "IN" if action == "ENTREE" else "OUT"
        
        is_allowed = check_time_allowed(action, time_str)
        
        if is_allowed:
            c.execute("UPDATE Utilisateurs SET etat_presence=? WHERE id=?", (new_presence, user_id))
            c.execute("INSERT INTO Historique (id_utilise, nom_utilisateur, date_heure, resultat, type_acces) VALUES (?, ?, ?, ?, ?)", 
                      (id_recu, nom_user, now_str, 'Autorisé', action))
            conn.commit()
            
            # Emit socketio event
            log_data = {"id_carte": id_recu, "nom": nom_user, "date": now_str, "resultat": 'Autorisé', "type_acces": action}
            socketio.emit('new_log', log_data)
            conn.close()
            return "OK", 200
        else:
            c.execute("INSERT INTO Historique (id_utilise, nom_utilisateur, date_heure, resultat, type_acces) VALUES (?, ?, ?, ?, ?)", 
                      (id_recu, nom_user, now_str, 'Refusé (Hors Horaire)', action))
            conn.commit()
            log_data = {"id_carte": id_recu, "nom": nom_user, "date": now_str, "resultat": 'Refusé (Hors Horaire)', "type_acces": action}
            socketio.emit('new_log', log_data)
            conn.close()
            return "HORS_HORAIRE", 200
    else:
        c.execute("INSERT INTO Historique (id_utilise, nom_utilisateur, date_heure, resultat, type_acces) VALUES (?, ?, ?, ?, ?)", 
                  (id_recu, "Inconnu", now_str, 'Refusé (Inconnu)', 'INCONNU'))
        conn.commit()
        log_data = {"id_carte": id_recu, "nom": "Inconnu", "date": now_str, "resultat": 'Refusé (Inconnu)', "type_acces": 'INCONNU'}
        socketio.emit('new_log', log_data)
        conn.close()
        return "NO", 200

@app.route('/api/utilisateurs', methods=['GET', 'POST'])
def gerer_utilisateurs():
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute("SELECT id, nom, id_rfid, id_basma, etat_presence FROM Utilisateurs")
        users = [{"id": row[0], "nom": row[1], "id_rfid": row[2], "id_basma": row[3], "etat_presence": row[4]} for row in c.fetchall()]
        conn.close()
        return jsonify(users)
        
    if request.method == 'POST':
        # NOTE: Ideally this should have @token_required but left open for ESP32/Frontend compatibility during transition
        data = request.get_json()
        c.execute("INSERT INTO Utilisateurs (nom, id_rfid, id_basma, statut, etat_presence) VALUES (?, ?, ?, 'Actif', 'OUT')", 
                  (data.get('nom'), data.get('id_rfid'), data.get('id_basma')))
        conn.commit()
        conn.close()
        socketio.emit('users_updated')
        return jsonify({"message": "Utilisateur ajouté"}), 201

@app.route('/api/utilisateurs/<int:id_user>', methods=['DELETE'])
@token_required
def delete_user(id_user):
    global etat_systeme
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    
    c.execute("SELECT id_basma FROM Utilisateurs WHERE id=?", (id_user,))
    user = c.fetchone()
    
    if user and user[0] and "FINGER_" in user[0]:
        id_num = user[0].replace("FINGER_", "") 
        etat_systeme["mode"] = "DELETE_BASMA"
        etat_systeme["id_a_supprimer"] = id_num
        socketio.emit('mode_changed', etat_systeme)
        
    c.execute("DELETE FROM Utilisateurs WHERE id=?", (id_user,))
    conn.commit()
    conn.close()
    socketio.emit('users_updated')
    return jsonify({"message": "Utilisateur supprimé"}), 200

@app.route('/api/logs', methods=['GET'])
def get_logs():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    offset = (page - 1) * per_page
    
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT id, date_heure, id_utilise, nom_utilisateur, resultat, type_acces FROM Historique ORDER BY date_heure DESC LIMIT ? OFFSET ?", (per_page, offset))
    logs = [{"id": row[0], "date": row[1], "id_carte": row[2], "nom": row[3], "resultat": row[4], "type_acces": row[5]} for row in c.fetchall()]
    
    c.execute("SELECT COUNT(*) FROM Historique")
    total = c.fetchone()[0]
    conn.close()
    
    return jsonify({
        "logs": logs,
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page
    })

@app.route('/api/stats', methods=['GET'])
@token_required
def get_stats():
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM Utilisateurs")
    total_users = c.fetchone()[0]
    
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    c.execute("SELECT COUNT(*) FROM Historique WHERE date_heure LIKE ? AND resultat='Autorisé'", (f"{today}%",))
    entries_today = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM Historique WHERE date_heure LIKE ? AND resultat LIKE 'Refusé%'", (f"{today}%",))
    failed_today = c.fetchone()[0]
    
    # Last 7 days data for chart
    chart_data = []
    for i in range(6, -1, -1):
        day = (datetime.datetime.now() - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        c.execute("SELECT COUNT(*) FROM Historique WHERE date_heure LIKE ? AND resultat='Autorisé'", (f"{day}%",))
        auth = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM Historique WHERE date_heure LIKE ? AND resultat LIKE 'Refusé%'", (f"{day}%",))
        ref = c.fetchone()[0]
        chart_data.append({"date": day[5:], "Autorisé": auth, "Refusé": ref})
        
    conn.close()
    return jsonify({
        "total_users": total_users,
        "entries_today": entries_today,
        "failed_today": failed_today,
        "chart_data": chart_data
    })

@app.route('/api/export-logs', methods=['GET'])
@token_required
def export_logs():
    conn = sqlite3.connect('rfid_system.db')
    c = conn.cursor()
    c.execute("SELECT id, date_heure, id_utilise, nom_utilisateur, resultat, type_acces FROM Historique ORDER BY date_heure DESC")
    logs = c.fetchall()
    conn.close()
    
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'Date/Heure', 'ID Utilise', 'Nom', 'Resultat', 'Type Acces'])
    cw.writerows(logs)
    
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=historique.csv"
    output.headers["Content-type"] = "text/csv"
    return output

if __name__ == '__main__':
    init_db()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)















# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import sqlite3
# import datetime

# app = Flask(__name__)
# CORS(app)

# def init_db():
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     c.execute('''CREATE TABLE IF NOT EXISTS Cartes (id_carte TEXT PRIMARY KEY, nom TEXT, statut TEXT)''')
#     c.execute('''CREATE TABLE IF NOT EXISTS Historique (id INTEGER PRIMARY KEY AUTOINCREMENT, id_carte TEXT, date_heure TEXT, resultat TEXT)''')
    
#     # La carte dyalk par defaut
#     c.execute("INSERT OR IGNORE INTO Cartes (id_carte, nom, statut) VALUES ('02E22A22', 'Ghait', 'Actif')")
    
#     conn.commit()
#     conn.close()

# @app.route('/api/verifier-carte', methods=['POST'])
# def verifier_carte():
#     data = request.get_json()
#     id_carte = data.get('id_carte')
#     if not id_carte: return "Erreur", 400
        
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     c.execute("SELECT * FROM Cartes WHERE id_carte=? AND statut='Actif'", (id_carte,))
#     carte = c.fetchone()
#     now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
#     if carte:
#         c.execute("INSERT INTO Historique (id_carte, date_heure, resultat) VALUES (?, ?, ?)", (id_carte, now, 'Autorisé'))
#         conn.commit()
#         conn.close()
#         return "OK", 200
#     else:
#         c.execute("INSERT INTO Historique (id_carte, date_heure, resultat) VALUES (?, ?, ?)", (id_carte, now, 'Refusé'))
#         conn.commit()
#         conn.close()
#         return "NO", 200

# @app.route('/api/logs', methods=['GET'])
# def get_logs():
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     c.execute('''SELECT Historique.id, Historique.date_heure, Historique.id_carte, Cartes.nom, Historique.resultat 
#                  FROM Historique LEFT JOIN Cartes ON Historique.id_carte = Cartes.id_carte 
#                  ORDER BY Historique.date_heure DESC''')
#     logs = c.fetchall()
#     conn.close()
#     resultat = [{"id": log[0], "date": log[1], "id_carte": log[2], "nom": log[3] if log[3] else "Inconnu", "resultat": log[4]} for log in logs]
#     return jsonify(resultat)

# @app.route('/api/cartes', methods=['GET'])
# def get_cartes():
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     c.execute("SELECT * FROM Cartes")
#     cartes = [{"id_carte": row[0], "nom": row[1], "statut": row[2]} for row in c.fetchall()]
#     conn.close()
#     return jsonify(cartes)

# @app.route('/api/cartes', methods=['POST'])
# def add_carte():
#     data = request.get_json()
#     id_carte = data.get('id_carte')
#     nom = data.get('nom')
    
#     if not id_carte or not nom:
#         return jsonify({"erreur": "Veuillez remplir tous les champs"}), 400
        
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     try:
#         c.execute("INSERT INTO Cartes (id_carte, nom, statut) VALUES (?, ?, 'Actif')", (id_carte, nom))
#         conn.commit()
#         msg = "Carte ajoutée avec succès"
#         status = 201
#     except sqlite3.IntegrityError:
#         msg = "Cette carte existe déjà"
#         status = 400
#     finally:
#         conn.close()
#     return jsonify({"message": msg}), status

# @app.route('/api/cartes/<id_carte>', methods=['DELETE'])
# def delete_carte(id_carte):
#     conn = sqlite3.connect('rfid_system.db')
#     c = conn.cursor()
#     c.execute("DELETE FROM Cartes WHERE id_carte=?", (id_carte,))
#     conn.commit()
#     conn.close()
#     return jsonify({"message": "Carte supprimée"}), 200

# if __name__ == '__main__':
#     init_db()
#     app.run(host='0.0.0.0', port=5000, debug=True)