export type DashboardColor = 'indigo' | 'emerald' | 'orange' | 'amber' | 'purple' | 'rose' | 'violet';

export interface DashboardColorClasses {
  border: string;
  iconBg: string;
  iconText: string;
  ring: string;
  iconHover: string;
  titleHover: string;
  cardHover: string;
  activeCard: string;
}

/** 儀表板快速操作／統計卡片的彩色樣式 */
export function getDashboardColorClasses(color: string): DashboardColorClasses {
  switch (color) {
    case 'indigo':
      return {
        border: 'border-primary/20',
        iconBg: 'bg-primary/10',
        iconText: 'text-primary',
        ring: 'ring-primary/30',
        iconHover: 'group-hover:bg-primary group-hover:text-white',
        titleHover: 'group-hover:text-primary',
        cardHover: 'hover:border-primary/40',
        activeCard: 'bg-primary/10 border-primary/40 ring-2 ring-primary/30',
      };
    case 'emerald':
      return {
        border: 'border-emerald-100',
        iconBg: 'bg-emerald-50',
        iconText: 'text-emerald-600',
        ring: 'ring-emerald-200',
        iconHover: 'group-hover:bg-emerald-600 group-hover:text-white',
        titleHover: 'group-hover:text-emerald-700',
        cardHover: 'hover:border-emerald-300',
        activeCard: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200',
      };
    case 'orange':
      return {
        border: 'border-orange-100',
        iconBg: 'bg-orange-50',
        iconText: 'text-orange-500',
        ring: 'ring-orange-200',
        iconHover: 'group-hover:bg-orange-500 group-hover:text-white',
        titleHover: 'group-hover:text-orange-600',
        cardHover: 'hover:border-orange-300',
        activeCard: 'bg-orange-50 border-orange-300 ring-2 ring-orange-200',
      };
    case 'amber':
      return {
        border: 'border-amber-100',
        iconBg: 'bg-amber-50',
        iconText: 'text-amber-500',
        ring: 'ring-amber-200',
        iconHover: 'group-hover:bg-amber-500 group-hover:text-white',
        titleHover: 'group-hover:text-amber-600',
        cardHover: 'hover:border-amber-300',
        activeCard: 'bg-amber-50 border-amber-300 ring-2 ring-amber-200',
      };
    case 'purple':
      return {
        border: 'border-tertiary/20',
        iconBg: 'bg-tertiary/10',
        iconText: 'text-tertiary',
        ring: 'ring-tertiary/30',
        iconHover: 'group-hover:bg-tertiary group-hover:text-white',
        titleHover: 'group-hover:text-tertiary',
        cardHover: 'hover:border-tertiary/40',
        activeCard: 'bg-tertiary/10 border-tertiary/40 ring-2 ring-tertiary/30',
      };
    case 'rose':
      return {
        border: 'border-rose-100',
        iconBg: 'bg-rose-50',
        iconText: 'text-rose-600',
        ring: 'ring-rose-200',
        iconHover: 'group-hover:bg-rose-600 group-hover:text-white',
        titleHover: 'group-hover:text-rose-700',
        cardHover: 'hover:border-rose-300',
        activeCard: 'bg-rose-50 border-rose-300 ring-2 ring-rose-200',
      };
    case 'violet':
      return {
        border: 'border-violet-100',
        iconBg: 'bg-violet-50',
        iconText: 'text-violet-600',
        ring: 'ring-violet-200',
        iconHover: 'group-hover:bg-violet-600 group-hover:text-white',
        titleHover: 'group-hover:text-violet-700',
        cardHover: 'hover:border-violet-300',
        activeCard: 'bg-violet-50 border-violet-300 ring-2 ring-violet-200',
      };
    default:
      return {
        border: 'border-gray-100',
        iconBg: 'bg-gray-50',
        iconText: 'text-gray-600',
        ring: 'ring-gray-200',
        iconHover: 'group-hover:bg-gray-600 group-hover:text-white',
        titleHover: 'group-hover:text-gray-700',
        cardHover: 'hover:border-gray-300',
        activeCard: 'bg-gray-50 border-gray-300 ring-2 ring-gray-200',
      };
  }
}
