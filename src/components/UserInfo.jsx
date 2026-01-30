import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserInfo.css';

const UserInfo = () => {
  const { user } = useAuth();

  if (!user) return null;

  const getRoleBadge = (rol) => {
    const badges = {
      admin: { icon: '👑', text: 'Admin', color: '#667eea' },
      supervisor: { icon: '👔', text: 'Supervisor', color: '#ed8936' },
      trabajador: { icon: '👷', text: 'Trabajador', color: '#48bb78' },
      operador: { icon: '�', text: 'Operador', color: '#48bb78' },
    };
    return badges[rol] || { icon: '👤', text: rol, color: '#718096' };
  };

  const badge = getRoleBadge(user.rol);

  return (
    <div className="user-info">
      <div className="user-avatar">
        <span className="avatar-icon">{badge.icon}</span>
      </div>
      <div className="user-details">
        <span className="user-name">{user.nombre || user.username}</span>
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
