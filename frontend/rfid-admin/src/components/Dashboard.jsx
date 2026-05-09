import { useState, useEffect, useContext } from 'react';
import { AuthContext, SocketContext } from '../App';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { API_URL, token } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [stats, setStats] = useState({ total_users: 0, entries_today: 0, failed_today: 0, chart_data: [] });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
    if (socket) {
      socket.on('new_log', fetchStats);
      socket.on('users_updated', fetchStats);
    }
    return () => {
      if (socket) {
        socket.off('new_log', fetchStats);
        socket.off('users_updated', fetchStats);
      }
    }
  }, [socket, token]);

  const cards = [
    { title: 'Utilisateurs Actifs', value: stats.total_users, icon: <Users size={24} className="text-blue-500" />, bg: 'bg-blue-500/10' },
    { title: 'Entrées Aujourd\'hui', value: stats.entries_today, icon: <UserCheck size={24} className="text-green-500" />, bg: 'bg-green-500/10' },
    { title: 'Tentatives Refusées', value: stats.failed_today, icon: <ShieldAlert size={24} className="text-red-500" />, bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold dark:text-white">Tableau de Bord</h2>
        <p className="text-slate-500 dark:text-slate-400">Vue d'ensemble du système d'accès</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                <h3 className="text-3xl font-bold mt-2 dark:text-white">{card.value}</h3>
              </div>
              <div className={`p-4 rounded-xl ${card.bg}`}>
                {card.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-[400px]"
      >
        <h3 className="text-lg font-semibold mb-6 dark:text-white">Activité sur 7 jours</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.chart_data}>
            <defs>
              <linearGradient id="colorAuth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRef" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="date" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
            <Area type="monotone" dataKey="Autorisé" stroke="#10b981" fillOpacity={1} fill="url(#colorAuth)" strokeWidth={2} />
            <Area type="monotone" dataKey="Refusé" stroke="#ef4444" fillOpacity={1} fill="url(#colorRef)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
