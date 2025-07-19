import { useState } from 'react';

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
    <div className={className || ''}>
      {groups.map(group => (
        <div key={group.id} className="mt-2 first:mt-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button
            className={`w-full text-left flex items-center justify-between p-3 md:p-5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors font-semibold text-base md:text-lg ${group.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={() => !group.disabled && handleToggle(group.id)}
            disabled={group.disabled}
            aria-expanded={openId === group.id}
            aria-controls={`accordion-content-${group.id}`}
            type="button"
          >
            <span>{group.title}</span>
            <svg
              className={`w-5 h-5 ml-2 transform sm:transition-transform ${openId === group.id ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            id={`accordion-content-${group.id}`}
            className={`transition-all sm:duration-200 md:duration-300 ${openId === group.id ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'} bg-white`}
            aria-hidden={openId !== group.id}
          >
            <div className="p-3 md:p-5">{group.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Accordion; 