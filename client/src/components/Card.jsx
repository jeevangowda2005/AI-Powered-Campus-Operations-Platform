import React from 'react';

/**
 * Metric Card Component for Dashboard UI Placeholders
 */
const Card = ({ title, value, icon: Icon, colorClass = 'card-icon-blue', description }) => {
  return (
    <div className="card">
      <div className="card-header-flex">
        <span className="card-title">{title}</span>
        {Icon && (
          <div className={`card-icon-wrap ${colorClass}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="card-value">{value}</div>
      {description && <div className="card-desc">{description}</div>}
    </div>
  );
};

export default Card;
