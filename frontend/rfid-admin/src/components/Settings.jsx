import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { Clock, Save } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Settings() {
  const { API_URL, token } = useContext(AuthContext);
  const [config, setConfig] = useState({
    heure_entree_debut: '00:00',
    heure_entree_fin: '23:59',
    heure_sortie_debut: '00:00',
    heure_sortie_fin: '23:59'
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/config`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setConfig(data))
    .catch(console.error);
  }, [API_URL, token]);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setMessage('Configuration enregistrée avec succès!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">Configuration des Horaires</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Définissez quand les utilisateurs peuvent entrer et sortir.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {message && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Heures d'Entrée</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">De (Heure début)</label>
                <input 
                  type="time" 
                  name="heure_entree_debut"
                  value={config.heure_entree_debut}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">À (Heure fin)</label>
                <input 
                  type="time" 
                  name="heure_entree_fin"
                  value={config.heure_entree_fin}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Heures de Sortie</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">De (Heure début)</label>
                <input 
                  type="time" 
                  name="heure_sortie_debut"
                  value={config.heure_sortie_debut}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">À (Heure fin)</label>
                <input 
                  type="time" 
                  name="heure_sortie_fin"
                  value={config.heure_sortie_fin}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 w-full justify-center">
              <Save size={20} />
              Enregistrer la configuration
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
