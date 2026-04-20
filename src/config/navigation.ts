import {
  LayoutDashboard,
  Bell,
  Calendar,
  Monitor,
  Mic,
  Clock,
  Users,
  UserCheck,
  Cpu,
  Building2,
  Briefcase,
  MapPin,
  Gem,
  Target,
  AlertTriangle,
  Gauge,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { UserSubtype } from '@/types/api';

export interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserSubtype[];
  children?: NavItem[];
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    titleKey: 'sidebar.dashboard',
    items: [
      {
        titleKey: 'sidebar.dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'],
      },
    ],
  },
  {
    titleKey: 'sidebar.monitoring',
    items: [
      {
        titleKey: 'sidebar.alertMonitor',
        href: '/alerts/monitor',
        icon: Monitor,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
      },
      {
        titleKey: 'sidebar.callRecordings',
        href: '/alerts/recordings',
        icon: Mic,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
      },
    ],
  },
  {
    titleKey: 'sidebar.timelines',
    items: [
      {
        titleKey: 'sidebar.alertOccurrences',
        href: '/alerts/occurrences',
        icon: Bell,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'],
      },
      {
        titleKey: 'sidebar.timeEntries',
        href: '/attendance',
        icon: Clock,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'],
      },
    ],
  },
  {
    titleKey: 'sidebar.schedules',
    items: [
      {
        titleKey: 'sidebar.alertScheduling',
        href: '/alerts/scheduling',
        icon: Calendar,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
    ],
  },
  {
    titleKey: 'sidebar.reports',
    items: [
      {
        titleKey: 'sidebar.reportAdherence',
        href: '/reports/adherence',
        icon: Target,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
      {
        titleKey: 'sidebar.reportAttendance',
        href: '/reports/attendance',
        icon: Clock,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
      },
      {
        titleKey: 'sidebar.reportSos',
        href: '/reports/sos',
        icon: AlertTriangle,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
      },
      {
        titleKey: 'sidebar.reportSla',
        href: '/reports/sla',
        icon: Gauge,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
    ],
  },
  {
    titleKey: 'sidebar.management',
    items: [
      {
        titleKey: 'sidebar.users',
        href: '/users',
        icon: Users,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
      },
      {
        titleKey: 'sidebar.collaborators',
        href: '/collaborators',
        icon: UserCheck,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
      {
        titleKey: 'sidebar.clients',
        href: '/clients',
        icon: Briefcase,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
      {
        titleKey: 'sidebar.sites',
        href: '/sites',
        icon: MapPin,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
      {
        titleKey: 'sidebar.equipment',
        href: '/equipment',
        icon: Cpu,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
      },
    ],
  },
  {
    titleKey: 'sidebar.company',
    items: [
      {
        titleKey: 'sidebar.companySettings',
        href: '/company',
        icon: Building2,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
      },
      {
        titleKey: 'sidebar.plan',
        href: '/plan',
        icon: Gem,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
      },
      {
        titleKey: 'sidebar.modules',
        href: '/modules',
        icon: SlidersHorizontal,
        roles: ['SUPER_ADMIN_MASTER'],
      },
    ],
  },
];
