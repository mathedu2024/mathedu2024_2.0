import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export interface AccordionGroup {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface AccordionProps {
  groups: AccordionGroup[];
  defaultOpenId?: string;
  className?: string;
}

const Accordion: React.FC<AccordionProps> = ({ groups, defaultOpenId, className }) => {
  const [openId, setOpenId] = useState<string>(defaultOpenId || groups[0]?.id || '');

  const handleToggle = (id: string) => {
    setOpenId(prev => (prev === id ? '' : id));
  };

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {groups.map(group => {
        const isOpen = openId === group.id;
        return (
            <div 
                key={group.id} 
                className={`bg-white border rounded-xl overflow-hidden transition-all duration-300 ${
                    isOpen ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-gray-200 shadow-sm'
                } ${group.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
            <button
                className={`w-full text-left flex items-center justify-between p-4 md:p-5 cursor-pointer transition-colors font-bold text-base md:text-lg ${
                    isOpen ? 'bg-indigo-50/50 text-indigo-900' : 'bg-white text-gray-800 hover:bg-gray-50'
                }`}
                onClick={() => !group.disabled && handleToggle(group.id)}
                disabled={group.disabled}
                aria-expanded={isOpen}
                aria-controls={`accordion-content-${group.id}`}
                type="button"
            >
                <span>{group.title}</span>
                <ChevronDownIcon 
                    className={`w-5 h-5 ml-2 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
                />
            </button>
            <div
                id={`accordion-content-${group.id}`}
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                }`}
                aria-hidden={!isOpen}
            >
                <div className="p-4 md:p-6 border-t border-gray-100 bg-white">
                    {group.content}
                </div>
            </div>
            </div>
        );
      })}
    </div>
  );
};

export default Accordion;