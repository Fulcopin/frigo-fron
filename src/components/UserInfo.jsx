import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserInfo.css';

const UserInfo = () => {
  const { user } = useAuth();

  if (!user) return null;

  const getRoleBadge = (rol) => {
    const normalizedRole = (rol || '').toLowerCase();
    const badges = {
      admin: { icon: '👑', text: 'Administrador', color: '#e53e3e' },
      supervisor: { icon: '👔', text: 'Supervisor', color: '#ed8936' },
      trabajador: { icon: '👷', text: 'Trabajador', color: '#48bb78' },
      operador: { icon: '🧑‍🔧', text: 'Operador', color: '#48bb78' },
    };
    return badges[normalizedRole] || { icon: '👤', text: rol || 'Usuario', color: '#718096' };
  };

  const badge = getRoleBadge(user.rol);

  return (
    <div className="user-info">
      <div className="user-avatar">
        <span className="avatar-icon">{badge.icon}</span>
      </div>
      <div className="user-details">
        <span className="user-name">
          {(user.nombre || user.username || '').replace(/-Adm$/i, '').trim()}
        </span>
        <span 
          className="user-role" 
          style={{ backgroundColor: badge.color }}
        >
          {badge.text}
        </span>
      </div>
    </div>
  );
};

export default UserInfo;
