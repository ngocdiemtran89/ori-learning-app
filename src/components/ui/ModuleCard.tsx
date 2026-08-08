import React from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  infoText?: string;
  color?: 'ori' | 'indigo' | 'purple' | 'emerald';
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  description,
  path,
  icon: Icon,
  badge,
  infoText,
  color = 'ori',
}) => {
  const colorStyles = {
    ori: 'bg-sky-50 text-ori-600 group-hover:border-ori-500',
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:border-indigo-500',
    purple: 'bg-purple-50 text-purple-600 group-hover:border-purple-500',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:border-emerald-500',
  };

  return (
    <NavLink
      to={path}
      className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between ${colorStyles[color]}`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold">
            <Icon className="w-5 h-5" />
          </div>
          {badge && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase">
              {badge}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mt-1">{description}</p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-ori-600">
        <span>{infoText || 'Bắt đầu học'}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </NavLink>
  );
};
