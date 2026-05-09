import { useState, useEffect, useContext } from 'react';
import { AuthContext, SocketContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, CreditCard, UserPlus, Trash2, Shield } from 'lucide-react';

export default function Users() {
  const { API_URL, token } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState('NORMAL');
  const [nom, setNom] = useState('');
  const [idRfid, setIdRfid] = useState('');
  const [idBasma, setIdBasma] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/utilisateurs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchUsers();
    
    // Fetch initial mode
    fetch(`${API_URL}/mode`).then(r => r.json()).then(data => {
      setMode(data.mode);
      if (data.id_carte_attente) setIdRfid(data.id_carte_attente);
      if (data.id_basma_attente) setIdBasma(data.id_basma_attente);
    });

    if (socket) {
      socket.on('users_updated', fetchUsers);
      socket.on('mode_changed', (data) => setMode(data.mode));
      socket.on('id_scanned', (data) => {
        setMode(data.mode);
        if (data.id_carte_attente) setIdRfid(data.id_carte_attente);
        if (data.id_basma_attente) setIdBasma(data.id_basma_attente);
      });
    }

    return () => {
      if (socket) {
        socket.off('users_updated', fetchUsers);
        socket.off('mode_changed');
        socket.off('id_scanned');
      }
    };
  }, [socket, token]);

  const activerScan = async (type) => {
    await fetch(`${API_URL}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: type })
    });
  };

  const handleAjouter = async (e) => {
    e.preventDefault();
    if (!idRfid && !idBasma) {
      alert("Vous devez enregistrer une carte ou une empreinte!"); return;
    }
    await fetch(`${API_URL}/utilisateurs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, id_rfid: idRfid, id_basma: idBasma })
    });
    setNom(''); setIdRfid(''); setIdBasma('');
  };

  const handleSupprimer = async (id) => {
    if(window.confirm("Voulez-vous vraiment supprimer cet utilisateur?")) {
      await fetch(`${API_URL}/utilisateurs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-rose-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ADD USER FORM */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit"
      >
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
            <UserPlus size={20} />
          </div>
          <h2 className="text-xl font-bold dark:text-white">Nouvel Utilisateur</h2>
        </div>
        
        <div className="flex gap-2 mb-6">
          <button 
            type="button"
            onClick={() => activerScan('ENROLL_CARTE')} 
            className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-2 font-medium transition-all ${mode === 'ENROLL_CARTE' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
          >
            <CreditCard size={20} />
            <span className="text-xs">Scanner Carte</span>
          </button>
          <button 
            type="button"
            onClick={() => activerScan('ENROLL_BASMA')} 
            className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-2 font-medium transition-all ${mode === 'ENROLL_BASMA' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
          >
            <Fingerprint size={20} />
            <span className="text-xs">Scanner Empreinte</span>
          </button>
        </div>

        <form onSubmit={handleAjouter} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">ID Carte</label>
            <input type="text" value={idRfid} readOnly className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm dark:text-slate-300 focus:outline-none" placeholder="En attente du scan..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">ID Empreinte</label>
            <input type="text" value={idBasma} readOnly className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm dark:text-slate-300 focus:outline-none" placeholder="En attente du scan..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Nom Complet</label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Jean Dupont" required />
          </div>
          
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all mt-4">
            Enregistrer l'utilisateur
          </button>
        </form>
      </motion.div>

      {/* USER LIST */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold dark:text-white">Liste des Utilisateurs</h2>
          <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
            {users.length} Total
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            <AnimatePresence>
              {users.map((u) => (
                <motion.li 
                  key={u.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-center gap-4"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner ${getAvatarColor(u.nom)}`}>
                    {getInitials(u.nom)}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      {u.nom}
                      {u.etat_presence === 'IN' && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">DANS LE BATIMENT</span>}
                    </h3>
                    <div className="flex gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><CreditCard size={12}/> {u.id_rfid || 'Non assigné'}</span>
                      <span className="flex items-center gap-1"><Fingerprint size={12}/> {u.id_basma || 'Non assigné'}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSupprimer(u.id)} 
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {users.length === 0 && (
            <div className="p-10 text-center text-slate-400">
              <Shield size={48} className="mx-auto mb-4 opacity-20" />
              <p>Aucun utilisateur enregistré pour le moment.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
