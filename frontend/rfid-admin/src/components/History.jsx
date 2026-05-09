import { useState, useEffect, useContext } from 'react';
import { AuthContext, SocketContext } from '../App';
import { Download, ChevronLeft, ChevronRight, Activity, LogIn, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function History() {
  const { API_URL, token } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/logs?page=${page}&per_page=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setPagination({ page: data.page, pages: data.pages, total: data.total });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(pagination.page);

    if (socket) {
      socket.on('new_log', () => {
        // Only refresh if we are on the first page
        if (pagination.page === 1) {
          fetchLogs(1);
        }
      });
    }
    return () => {
      if (socket) socket.off('new_log');
    };
  }, [socket, token, pagination.page]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/export-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erreur d'export");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historique.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'export.");
    }
  };

  const getStatusBadge = (resultat) => {
    if (resultat.includes('Autorisé')) return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Autorisé</span>;
    if (resultat.includes('Hors Horaire')) return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">Hors Horaire</span>;
    return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Refusé</span>;
  };

  const getTypeIcon = (type) => {
    if (type === 'ENTREE') return <span className="flex items-center gap-1 text-blue-600"><LogIn size={14} /> Entrée</span>;
    if (type === 'SORTIE') return <span className="flex items-center gap-1 text-purple-600"><LogOut size={14} /> Sortie</span>;
    return <span className="text-slate-400">-</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)]"
    >
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold dark:text-white">Historique des Accès</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{pagination.total} enregistrements</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Exporter CSV
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-md">
            <tr className="text-xs uppercase tracking-wider font-semibold">
              <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">Date et Heure</th>
              <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">Utilisateur</th>
              <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">ID Utilisé</th>
              <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{log.date}</td>
                <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">{log.nom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{getTypeIcon(log.type_acces)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-900/50 inline-block m-4 rounded px-2 py-1">{log.id_carte}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">{getStatusBadge(log.resultat)}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400">Aucun accès enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
        <span className="text-sm text-slate-500 dark:text-slate-400">Page {pagination.page} sur {pagination.pages}</span>
        <div className="flex gap-2">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
            className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            disabled={pagination.page >= pagination.pages}
            onClick={() => fetchLogs(pagination.page + 1)}
            className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
