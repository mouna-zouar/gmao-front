import React from 'react';
import { Link } from 'react-router-dom';
import SpotlightCard from '../../ui/SpotlightCard';
import './Dashboard.css';
import { NAV_ITEMS } from '../../../constants/navigation';
import dashboardBg from '../../../assets/dashboard-bg.jpg';

export default function Dashboard() {
  const modules = NAV_ITEMS.filter((item) => item.id !== 'dashboard');

  return (
    <div className="dashboard-wrapper">
      <img src={dashboardBg} className="dashboard-bg-img" alt="" />
      <div className="dashboard-overlay-content">
        <div className="dashboard-header">
          <h1>GMAO - Gestion de la Maintenance</h1>
          <p>Bienvenue dans votre espace de gestion de maintenance assistée par ordinateur</p>
        </div>

        <div className="dashboard-grid">
          {modules.map((item) => (
            <SpotlightCard
              key={item.id}
              spotlightColor="rgba(45, 212, 191, 0.25)"
              className="dashboard-card"
            >
              <div className="card-inner">
                <div className="card-front">
                  <div className="icon-wrapper">
                    {React.cloneElement(item.icon, { width: 40, height: 40 })}
                  </div>
                  <h3>{item.label}</h3>
                  <p className="card-description">
                    Gérer les {item.label.toLowerCase()}
                  </p>
                </div>

                <div className="card-back">
                  {item.children?.length > 0 ? (
                    <div className={`sub-module-grid ${item.children.length > 4 ? 'compact' : ''}`}>
                      {item.children.map((child, idx) => (
                        <Link key={idx} to={child.path || '#'} className="sub-module-item">
                          <div className="sub-module-icon">
                            {React.cloneElement(child.icon, {
                              width: item.children.length > 4 ? 14 : 18,
                              height: item.children.length > 4 ? 14 : 18,
                            })}
                          </div>
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="sub-module-single">
                      <Link to={item.path || '#'} className="sub-module-item">
                        <div className="sub-module-icon">
                          {React.cloneElement(item.icon, { width: 22, height: 22 })}
                        </div>
                        <span>Accéder</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </div>
  );
}