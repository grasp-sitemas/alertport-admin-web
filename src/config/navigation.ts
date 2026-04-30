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
  History,
  Shield,
  Activity,
  ListOrdered,
  CalendarCheck,
  BarChart3,
  Users2,
  Cog,
  Plug,
  BatteryLow,
  ToggleRight,
  ShieldAlert,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import type { UserSubtype } from '@/types/api';

export interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  roles: UserSubtype[];
  children?: NavItem[];
  /**
   * Per-account module key this nav item requires. When set, the sidebar
   * hides this item if the account has the module disabled via /modules.
   * Items without a `moduleKey` are treated as always-available admin
   * surfaces (e.g. dashboard, plan, /modules itself).
   *
   * Fail-open semantics live in {@link useSessionAccountModules} - if
   * the module map can't be fetched, the item stays visible.
   */
  moduleKey?: string;
}

export interface NavSection {
  titleKey: string;
  /**
   * Icon shown in the accordion section trigger. Pick something that
   * sums up the section semantically — items keep their own icons.
   */
  icon: LucideIcon;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    titleKey: 'sidebar.dashboard',
    icon: LayoutDashboard,
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
    icon: Activity,
    items: [
      {
        titleKey: 'sidebar.alertMonitor',
        href: '/alerts/monitor',
        icon: Monitor,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'MONITOR',
      },
      {
        titleKey: 'sidebar.callRecordings',
        href: '/alerts/recordings',
        icon: Mic,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'RECORDINGS',
      },
    ],
  },
  {
    titleKey: 'sidebar.timelines',
    icon: ListOrdered,
    items: [
      {
        titleKey: 'sidebar.alertOccurrences',
        href: '/alerts/occurrences',
        icon: Bell,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'],
        moduleKey: 'OCCURRENCES',
      },
      {
        titleKey: 'sidebar.timeEntries',
        href: '/attendance',
        icon: Clock,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'],
        moduleKey: 'TIME_ENTRIES',
      },
    ],
  },
  {
    titleKey: 'sidebar.schedules',
    icon: CalendarCheck,
    items: [
      {
        titleKey: 'sidebar.alertScheduling',
        href: '/alerts/scheduling',
        icon: Calendar,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'SCHEDULING',
      },
    ],
  },
  {
    titleKey: 'sidebar.reports',
    icon: BarChart3,
    items: [
      {
        titleKey: 'sidebar.reportAdherence',
        href: '/reports/adherence',
        icon: Target,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportAttendance',
        href: '/reports/attendance',
        icon: Clock,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportSos',
        href: '/reports/sos',
        icon: AlertTriangle,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportSla',
        href: '/reports/sla',
        icon: Gauge,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'REPORTS',
      },
      // ── Operação dos Dispositivos ────────────────────────
      // Five device-event slices over the same eventTypes
      // collection (filtered server-side). Same role gating
      // as the other reports - any operator+ can read them.
      {
        titleKey: 'sidebar.reportPowerEvents',
        href: '/reports/power-events',
        icon: Plug,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportBatteryLow',
        href: '/reports/battery-low',
        icon: BatteryLow,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportEquipmentStatus',
        href: '/reports/equipment-status',
        icon: ToggleRight,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportViolation',
        href: '/reports/violation',
        icon: ShieldAlert,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
      {
        titleKey: 'sidebar.reportRemoteRestart',
        href: '/reports/remote-restart',
        icon: RotateCcw,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR'],
        moduleKey: 'REPORTS',
      },
    ],
  },
  {
    titleKey: 'sidebar.management',
    icon: Users2,
    items: [
      {
        titleKey: 'sidebar.companies',
        href: '/companies',
        icon: Building2,
        // SUPER_ADMIN_MASTER-only platform surface. Sits at the top of
        // Gestão because company (ACCOUNT) is the root of the hierarchy
        // every other item inherits from. ADMIN and below only see
        // their own account via /company, not the full list.
        roles: ['SUPER_ADMIN_MASTER'],
      },
      {
        titleKey: 'sidebar.clients',
        href: '/clients',
        icon: Briefcase,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'CLIENTS',
      },
      {
        titleKey: 'sidebar.sites',
        href: '/sites',
        icon: MapPin,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'SITES',
      },
      {
        titleKey: 'sidebar.users',
        href: '/users',
        icon: Users,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
        moduleKey: 'USERS',
      },
      {
        titleKey: 'sidebar.collaborators',
        href: '/collaborators',
        icon: UserCheck,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'COLLABORATORS',
      },
      {
        titleKey: 'sidebar.equipment',
        href: '/equipment',
        icon: Cpu,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'],
        moduleKey: 'EQUIPMENT',
      },
    ],
  },
  {
    titleKey: 'sidebar.company',
    icon: Cog,
    items: [
      {
        titleKey: 'sidebar.companySettings',
        href: '/company',
        icon: Building2,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
        moduleKey: 'COMPANY_SETTINGS',
      },
      {
        titleKey: 'sidebar.plan',
        href: '/plan',
        icon: Gem,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
        // No moduleKey - billing surface is always available.
      },
      {
        titleKey: 'sidebar.modules',
        href: '/modules',
        icon: SlidersHorizontal,
        roles: ['SUPER_ADMIN_MASTER'],
        // No moduleKey - /modules is itself the toggle UI.
      },
      {
        titleKey: 'auditLog.sidebar',
        href: '/audit-logs',
        icon: History,
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
        // No moduleKey - audit log is a compliance surface; it must
        // stay reachable even if an account disables individual
        // feature modules, so admins can see what was toggled.
      },
      {
        titleKey: 'account.sidebar',
        href: '/account',
        icon: Shield,
        // ADMIN roles only. LGPD rights are still personal to every
        // data subject, but an OPERATOR self-deleting mid-shift would
        // be operationally catastrophic (their active attendance
        // dangles, their site loses coverage). MANAGER / OPERATOR /
        // AUDITOR who want to exercise their data-subject rights go
        // through the ADMIN of their account or the DPO email
        // listed in the privacy policy (privacidade@alertport.com.br).
        roles: ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'],
      },
    ],
  },
];
