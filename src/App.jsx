import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileClock,
  Fingerprint,
  Gauge,
  GitBranch,
  History,
  Layers3,
  LineChart,
  ListChecks,
  Menu,
  MessageSquareText,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react';
import TaskApp from './TaskApp.jsx';

const navItems = [
  { label: '产品', href: '#products' },
  { label: '功能', href: '#features' },
  { label: '界面', href: '#showcase' },
  { label: '价格', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const trustUnits = ['运营中心', '法务部', '采购中心', '客户成功部', '资产部', '财务共享中心'];

const goals = [
  {
    icon: Users,
    title: '每个任务都有明确负责人',
    copy: '任务创建、接收、转派、协办时自动绑定负责人、协同人与所属单位。',
    stat: '100%',
    label: '责任归属',
  },
  {
    icon: Workflow,
    title: '跨人员、跨单位顺畅流转',
    copy: '发起、承办、协办、退回、转派、验收与归档都进入同一条流转链。',
    stat: '8.4h',
    label: '流转提速',
  },
  {
    icon: History,
    title: '每次状态变化都有记录',
    copy: '前后状态、操作者、时间戳、备注和附件形成可追溯的审计历史。',
    stat: '0',
    label: '节点遗漏',
  },
  {
    icon: TimerReset,
    title: '停留时间自动统计',
    copy: '按处理人、单位、状态和任务类型拆解耗时，定位等待和阻塞。',
    stat: '12',
    label: '统计维度',
  },
  {
    icon: Gauge,
    title: '管理者一眼看清效率',
    copy: '积压、超时、完成率、平均处理时长和单位效率实时汇总。',
    stat: '24/7',
    label: '动态监控',
  },
];

const productTiles = [
  {
    icon: ListChecks,
    title: '任务台账',
    desc: '统一记录任务来源、优先级、负责人、单位与当前进度。',
    tint: 'bg-[#f7f1e8] text-[#8a5a2c] border-[#eadbc4] dark:bg-[#2a2518] dark:text-[#c9a07a] dark:border-[#4a4030]',
  },
  {
    icon: GitBranch,
    title: '流转规则',
    desc: '为不同任务类型配置跨部门路径、回退条件和验收节点。',
    tint: 'bg-[#ecf6f4] text-teal border-[#cde8e3] dark:bg-[#1a2a26] dark:text-teal dark:border-[#3a5a50]',
  },
  {
    icon: FileClock,
    title: '状态账本',
    desc: '每次状态变化都留下原因、操作者、前后状态和时间线。',
    tint: 'bg-[#f4eef8] text-violet border-[#e4d5ef] dark:bg-[#2a2235] dark:text-violet dark:border-[#4a4060]',
  },
  {
    icon: LineChart,
    title: '效率看板',
    desc: '按人员、单位、状态统计停留时长、积压和超时风险。',
    tint: 'bg-[#fff3ed] text-coral border-[#f4d0c3] dark:bg-[#2a2018] dark:text-coral dark:border-[#5a4030]',
  },
];

const featureRows = [
  {
    number: '01',
    title: '责任归属',
    desc: '负责人快照会随每次接收、转派、协办和验收自动保存，历史责任不会被覆盖。',
    tags: ['负责人', '协同人', '单位快照'],
  },
  {
    number: '02',
    title: '流转引擎',
    desc: '把人、部门、外部单位和审批节点组织成可配置的流转网络，支持退回与转派。',
    tags: ['转派', '退回', '验收'],
  },
  {
    number: '03',
    title: '状态账本',
    desc: '每次状态变化都记录原因、操作者、时间戳和前后状态，形成任务审计链。',
    tags: ['时间线', '审计', '备注'],
  },
  {
    number: '04',
    title: '效率洞察',
    desc: '按人员、单位、状态和任务类型统计停留时长，自动识别积压与临界超时。',
    tags: ['SLA', '积压', '瓶颈'],
  },
];

const automations = [
  {
    icon: Bot,
    title: '自动分派',
    copy: '新任务按类型、单位、负载和历史处理效率分配负责人。',
  },
  {
    icon: CalendarClock,
    title: '超时催办',
    copy: '任务接近 SLA 前自动提醒负责人、协同人和主管。',
  },
  {
    icon: BrainCircuit,
    title: '周报生成',
    copy: '从任务历史自动汇总本周积压、完成和低效流转原因。',
  },
];

const pricing = [
  {
    name: 'Team',
    price: '¥399',
    unit: '/月',
    desc: '适合 20 人以内团队快速规范任务流转。',
    features: ['任务责任人追踪', '基础状态流转', '处理时长统计', '团队效率看板'],
  },
  {
    name: 'Business',
    price: '¥1,299',
    unit: '/月',
    desc: '适合多部门协同，覆盖管理者监控与 SLA。',
    features: ['跨单位流转配置', '状态历史审计', '超时预警与催办', '高级统计报表', '权限与角色管理'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '定制',
    unit: '',
    desc: '适合集团、政企和复杂组织流程。',
    features: ['私有化部署', '组织架构同步', '数据仓库对接', '专属成功经理', '审计与合规支持'],
  },
];

const faqs = [
  {
    q: '它和普通待办工具有什么区别？',
    a: 'FlowDesk 不只记录待办项，而是围绕负责人、单位流转、状态历史和停留时间建立任务账本，重点服务管理者对责任、效率和积压的判断。',
  },
  {
    q: '能否统计任务在某个人或某个单位停留多久？',
    a: '可以。系统会按处理人、单位、状态、任务类型和优先级自动聚合停留时长，也能筛选超时与反复退回任务。',
  },
  {
    q: '是否支持跨部门转派和退回？',
    a: '支持。你可以配置不同单位之间的流转规则，并在每次转派、退回、协办、验收时保留完整操作记录。',
  },
  {
    q: '管理层能看到哪些指标？',
    a: '可查看任务积压量、超时率、完成率、平均处理时长、单位处理效率、负责人负载和状态分布。',
  },
];

function MarketingApp() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const [teamSize, setTeamSize] = useState(80);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    document.querySelectorAll('.reveal').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-porcelain text-ink dark:bg-[#111315] dark:text-[#f4f4f5]">
      <Header mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main>
        <Hero />
        <TrustBar />
        <ProductSuite />
        <GoalStrip />
        <Features />
        <AutomationLayer />
        <Showcase />
        <Management />
        <Savings teamSize={teamSize} setTeamSize={setTeamSize} />
        <Pricing />
        <FAQ activeFaq={activeFaq} setActiveFaq={setActiveFaq} />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  if (window.location.pathname.startsWith('/app')) {
    return <TaskApp />;
  }
  return <MarketingApp />;
}

function Header({ mobileOpen, setMobileOpen }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-porcelain/[0.90] backdrop-blur-xl dark:border-white/5 dark:bg-[#111315]/[0.90]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="FlowDesk 首页">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-[15px] font-semibold text-white shadow-line dark:bg-[#f4f4f5] dark:text-ink">
            F
          </span>
          <span className="text-lg font-semibold tracking-normal">FlowDesk</span>
        </a>

        <nav
          className="hidden h-12 items-center rounded-xl border border-line bg-white/[0.72] p-1 text-[15px] font-medium text-graphite/[0.74] shadow-line backdrop-blur md:flex dark:border-[#333] dark:bg-[#222]/[0.72] dark:text-[#a0a0a0]"
          aria-label="主导航"
        >
          {navItems.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className={`inline-flex h-10 min-w-16 items-center justify-center rounded-lg px-4 transition ${
                index === 0 ? 'bg-ink text-white shadow-line dark:bg-[#f4f4f5] dark:text-ink' : 'hover:bg-mist hover:text-ink dark:hover:bg-[#333] dark:hover:text-[#f4f4f5]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href="#pricing" className="inline-flex h-11 items-center rounded-lg px-3 text-[15px] font-semibold text-graphite/[0.72] transition hover:bg-white hover:text-ink dark:text-[#a0a0a0] dark:hover:bg-[#333] dark:hover:text-[#f4f4f5]">
            查看价格
          </a>
          <a
            href="/app"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-ink px-5 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-porcelain dark:bg-[#f4f4f5] dark:text-ink dark:hover:bg-white dark:focus:ring-[#f4f4f5] dark:focus:ring-offset-[#111315]"
          >
            进入系统
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <button
          type="button"
          className="inline-grid size-11 place-items-center rounded-md border border-line bg-white text-ink md:hidden dark:border-[#333] dark:bg-[#222] dark:text-[#f4f4f5]"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-porcelain px-5 pb-5 pt-3 md:hidden dark:border-[#333] dark:bg-[#111315]">
          <nav className="flex flex-col gap-1" aria-label="移动导航">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-graphite dark:text-[#a0a0a0]"
              >
                {item.label}
              </a>
            ))}
            <a
              href="/app"
              onClick={() => setMobileOpen(false)}
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white dark:bg-[#f4f4f5] dark:text-ink"
            >
              进入系统
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="grain relative overflow-hidden pt-20">
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-porcelain to-transparent dark:from-[#111315] dark:to-transparent" />
      <SketchMarks />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20 lg:pb-20">
        <div className="hero-enter mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.76] px-3 py-1.5 text-xs font-medium text-graphite shadow-line backdrop-blur dark:border-[#333] dark:bg-[#222]/[0.76] dark:text-[#a0a0a0]">
            <Sparkles size={13} className="text-teal" aria-hidden="true" />
            像 Notion 一样轻，专为任务流转而深
          </div>
          <h1 className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-normal text-ink sm:text-7xl lg:text-[92px] dark:text-[#f4f4f5]">
            FlowDesk 任务流转中枢
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-graphite/[0.76] sm:text-xl dark:text-[#a0a0a0]/[0.76]">
            把责任人、流转路径、状态历史与停留时间放进同一个工作空间，让每个任务从”谁负责”到”哪里耗时”都有答案。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-porcelain dark:bg-[#f4f4f5] dark:text-ink dark:hover:bg-white dark:focus:ring-[#f4f4f5] dark:focus:ring-offset-[#111315]"
            >
              进入任务系统
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a
              href="#products"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-5 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:border-ink/[0.24] focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-porcelain dark:border-[#333] dark:bg-[#222] dark:text-[#f4f4f5] dark:hover:border-[#444]"
            >
              <Play size={16} aria-hidden="true" />
              看能力矩阵
            </a>
          </div>
        </div>

        <div className="hero-enter-delay relative mx-auto mt-12 max-w-6xl">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function SketchMarks() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-20 mx-auto hidden h-[520px] w-full max-w-7xl text-ink/[0.12] lg:block dark:text-[#f4f4f5]/[0.12]"
      viewBox="0 0 1200 520"
      fill="none"
      aria-hidden="true"
    >
      <path d="M92 218c24-48 72-72 144-72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M1002 86c54 14 86 42 96 82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M1007 96l36-22M1008 96l25 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M152 322c28 14 60 12 94-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M926 352c32 30 82 34 148 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HeroVisual() {
  const [view, setView] = useState('table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const tasks = [
    {
      id: 'FD-1048',
      title: '供应商准入资料复核',
      owner: '周岚',
      dept: '采购中心',
      status: '待我确认',
      priority: '高',
      due: '今日 18:00',
      duration: '8.1h',
      group: '待确认',
    },
    {
      id: 'FD-1047',
      title: '合同验收确认',
      owner: '李然',
      dept: '法务部',
      status: '验收中',
      priority: '中',
      due: '明日 10:00',
      duration: '2.4h',
      group: '处理中',
    },
    {
      id: 'FD-1046',
      title: '客户资料补正',
      owner: '许宁',
      dept: '客户成功部',
      status: '已超时',
      priority: '高',
      due: '昨日 17:30',
      duration: '12.6h',
      group: '已超时',
    },
    {
      id: 'FD-1045',
      title: '设备维修派单',
      owner: '孟青',
      dept: '资产部',
      status: '处理中',
      priority: '低',
      due: '周五 16:00',
      duration: '1.9h',
      group: '处理中',
    },
  ];
  const task = tasks.find((item) => item.id === selectedTask) ?? tasks[0];

  const openTask = (id) => {
    setSelectedTask(id);
    setDrawerOpen(true);
  };

  return (
    <div className="relative">
      <div className="visual-float overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#F7F7F5] shadow-[0_20px_60px_rgba(17,24,39,0.08)] dark:border-[#333] dark:bg-[#18181b] dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="grid min-w-[1120px] grid-cols-[226px_1fr] text-[13px] text-[#111827] dark:text-[#f4f4f5]">
          <aside className="min-h-[640px] border-r border-[#E5E7EB] bg-[#F7F7F5] p-4 dark:border-[#333] dark:bg-[#18181b]">
            <div className="mb-5 flex items-center gap-2 px-2">
              <span className="grid size-8 place-items-center rounded-[10px] bg-[#111827] text-xs font-semibold text-white dark:bg-[#f4f4f5] dark:text-[#111827]">
                F
              </span>
              <div>
                <div className="text-sm font-semibold">FlowDesk</div>
                <div className="text-xs text-[#6B7280] dark:text-[#9ca3af]">任务流转工作区</div>
              </div>
            </div>

            <div className="space-y-1">
              {[
                ['我的待办', ListChecks, '23'],
                ['我创建的', FileCheck2, '12'],
                ['我参与的', Users, '48'],
                ['待我确认', ClipboardCheck, '8'],
                ['已超时', Clock3, '5'],
                ['已归档', FileClock, ''],
              ].map(([label, Icon, count], index) => (
                <button
                  key={label}
                  type="button"
                  className={`flex h-10 w-full items-center justify-between rounded-[10px] px-3 text-left transition ${
                    index === 0 ? 'bg-white font-medium shadow-[0_0_0_1px_rgba(229,231,235,1)] dark:bg-[#222] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]' : 'text-[#6B7280] hover:bg-white dark:text-[#9ca3af] dark:hover:bg-[#222]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </span>
                  {count && <span className="text-xs text-[#9CA3AF] dark:text-[#6b7280]">{count}</span>}
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-[#E5E7EB] pt-4 dark:border-[#333]">
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase text-[#9CA3AF] dark:text-[#6b7280]">统计</div>
              {[
                ['任务总览', BarChart3],
                ['人员统计', Users],
                ['部门统计', Building2],
              ].map(([label, Icon]) => (
                <button
                  key={label}
                  type="button"
                  className="flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[#6B7280] transition hover:bg-white hover:text-[#111827] dark:text-[#9ca3af] dark:hover:bg-[#222] dark:hover:text-[#f4f4f5]"
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <section className="relative flex min-h-[640px] flex-col overflow-hidden bg-[#F7F7F5] dark:bg-[#18181b]">
            <header className="flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-[#F7F7F5] px-5 dark:border-[#333] dark:bg-[#18181b]">
              <div className="flex h-10 w-[360px] items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-[#6B7280] dark:border-[#333] dark:bg-[#222] dark:text-[#9ca3af]">
                <Search size={15} aria-hidden="true" />
                <span>搜索任务、人员、单位</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterOpen((open) => !open)}
                  className="h-10 rounded-[10px] border border-[#E5E7EB] bg-white px-3 font-medium text-[#374151] transition hover:border-[#D1D5DB] dark:border-[#333] dark:bg-[#222] dark:text-[#d1d5db] dark:hover:border-[#444]"
                >
                  筛选 / 排序 / 分组
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="h-10 rounded-[10px] bg-[#2563EB] px-4 font-medium text-white transition hover:bg-[#1D4ED8]"
                >
                  新建任务
                </button>
              </div>

              {filterOpen && (
                <div className="absolute right-32 top-14 z-20 w-72 rounded-[12px] border border-[#E5E7EB] bg-white p-3 shadow-[0_12px_32px_rgba(17,24,39,0.10)] dark:border-[#333] dark:bg-[#222] dark:shadow-[0_12px_32px_rgba(0,0,0,0.3)]">
                  <div className="mb-3 text-sm font-semibold">筛选条件</div>
                  {['仅看我负责', '按到期时间排序', '按部门分组'].map((item, index) => (
                    <label key={item} className="flex h-9 items-center justify-between rounded-[10px] px-2 text-[#374151] dark:text-[#d1d5db]">
                      <span>{item}</span>
                      <input type="checkbox" defaultChecked={index === 0} className="accent-[#2563EB]" />
                    </label>
                  ))}
                </div>
              )}
            </header>

            <div className="flex-1 overflow-hidden p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold">我的待办</h2>
                  <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9ca3af]">聚合需要你处理、确认和关注的任务。</p>
                </div>
                <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#2563EB] dark:border-[#3a50a0] dark:bg-[#1a2030] dark:text-[#60a5fa]">
                  实时同步
                </span>
              </div>

              <DashboardCards />

              <div className="mt-4 flex items-center justify-between">
                <div className="inline-flex rounded-[11px] border border-[#E5E7EB] bg-white p-1 dark:border-[#333] dark:bg-[#222]">
                  {[
                    ['table', '表格视图'],
                    ['board', '看板视图'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      className={`h-8 rounded-[9px] px-3 text-xs font-medium transition ${
                        view === key ? 'bg-[#111827] text-white dark:bg-[#f4f4f5] dark:text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9ca3af] dark:hover:bg-[#333]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="h-8 rounded-[9px] px-3 text-xs font-medium text-[#6B7280] hover:bg-white dark:text-[#9ca3af] dark:hover:bg-[#222]">
                  更多
                </button>
              </div>

              <div className="mt-4 min-w-0">
                {view === 'table' ? (
                  <TaskTablePreview tasks={tasks} selectedTask={selectedTask} onOpenTask={openTask} />
                ) : (
                  <TaskBoardPreview tasks={tasks} onOpenTask={openTask} />
                )}
              </div>
            </div>

            <TaskDetailDrawer task={task} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
            <TaskCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardCards() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[
        ['我的待办', '23', 'text-[#2563EB]'],
        ['待我确认', '8', 'text-[#7C3AED]'],
        ['今日到期', '12', 'text-[#B45309]'],
        ['已超时', '5', 'text-[#DC2626]'],
        ['本周完成', '86', 'text-[#059669]'],
      ].map(([label, value, color]) => (
        <div key={label} className="rounded-[12px] border border-[#E5E7EB] bg-white p-3 dark:border-[#333] dark:bg-[#222]">
          <div className="text-xs text-[#6B7280] dark:text-[#9ca3af]">{label}</div>
          <div className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Badge({ children, tone = 'gray' }) {
  const tones = {
    blue: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] dark:border-[#3a50a0] dark:bg-[#1a2030] dark:text-[#60a5fa]',
    purple: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED] dark:border-[#4a4060] dark:bg-[#2a2235] dark:text-[#a78bfa]',
    red: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] dark:border-[#5a3030] dark:bg-[#2a2020] dark:text-[#f87171]',
    amber: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#5a4020] dark:bg-[#2a2010] dark:text-[#fbbf24]',
    green: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#059669] dark:border-[#3a5030] dark:bg-[#1a2520] dark:text-[#34d399]',
    gray: 'border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] dark:border-[#333] dark:bg-[#222] dark:text-[#9ca3af]',
  };

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function statusTone(status) {
  if (status === '待我确认') return 'blue';
  if (status === '已超时') return 'red';
  if (status === '处理中') return 'purple';
  return 'green';
}

function priorityTone(priority) {
  if (priority === '高') return 'red';
  if (priority === '中') return 'amber';
  return 'gray';
}

function TaskTablePreview({ tasks, selectedTask, onOpenTask }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white dark:border-[#333] dark:bg-[#222]">
      <div className="grid h-10 grid-cols-[minmax(180px,1fr)_64px_78px_76px_64px_52px] items-center border-b border-[#E5E7EB] px-4 text-xs font-medium text-[#6B7280] dark:border-[#333] dark:text-[#9ca3af]">
        <span>任务</span>
        <span>负责人</span>
        <span>部门</span>
        <span>状态</span>
        <span>优先级</span>
        <span>耗时</span>
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`grid h-[52px] grid-cols-[minmax(180px,1fr)_64px_78px_76px_64px_52px] items-center border-b border-[#E5E7EB] px-4 last:border-b-0 dark:border-[#333] ${
            selectedTask === task.id ? 'bg-[#F9FAFB] dark:bg-[#1a1a1a]' : ''
          }`}
        >
          <button type="button" onClick={() => onOpenTask(task.id)} className="min-w-0 truncate pr-3 text-left font-medium text-[#111827] hover:text-[#2563EB] dark:text-[#f4f4f5] dark:hover:text-[#60a5fa]">
            {task.title}
          </button>
          <span className="text-[#6B7280] dark:text-[#9ca3af]">{task.owner}</span>
          <span className="text-[#6B7280] dark:text-[#9ca3af]">{task.dept}</span>
          <Badge tone={statusTone(task.status)}>{task.status}</Badge>
          <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
          <span className="font-medium tabular-nums">{task.duration}</span>
        </div>
      ))}
    </div>
  );
}

function TaskBoardPreview({ tasks, onOpenTask }) {
  const groups = ['处理中', '待确认', '已超时'];

  return (
    <div className="grid gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-3 sm:grid-cols-3 dark:border-[#333] dark:bg-[#222]">
      {groups.map((group) => (
        <div key={group} className="rounded-[12px] bg-[#F7F7F5] p-3 dark:bg-[#1a1a1a]">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium">{group}</span>
            <span className="text-xs text-[#6B7280] dark:text-[#9ca3af]">{tasks.filter((task) => task.group === group).length}</span>
          </div>
          <div className="space-y-2">
            {tasks
              .filter((task) => task.group === group)
              .map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="w-full rounded-[12px] border border-[#E5E7EB] bg-white p-3 text-left transition hover:border-[#BFDBFE] dark:border-[#333] dark:bg-[#222] dark:hover:border-[#3a50a0]"
                >
                  <div className="font-medium">{task.title}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={statusTone(task.status)}>{task.status}</Badge>
                    <span className="text-xs text-[#6B7280] dark:text-[#9ca3af]">{task.owner}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskDetailDrawer({ task, open, onClose }) {
  return (
    <aside
      className={`absolute inset-y-0 right-0 z-20 w-[390px] border-l border-[#E5E7EB] bg-white shadow-[-18px_0_38px_rgba(17,24,39,0.08)] transition-transform duration-300 dark:border-[#333] dark:bg-[#222] dark:shadow-[-18px_0_38px_rgba(0,0,0,0.3)] ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <div className="flex h-16 items-center justify-between border-b border-[#E5E7EB] px-5 dark:border-[#333]">
        <div>
          <span className="text-sm font-semibold">任务详情</span>
          <div className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9ca3af]">右侧抽屉 · 不离开当前列表</div>
        </div>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[9px] text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9ca3af] dark:hover:bg-[#333]" aria-label="关闭详情">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="h-[calc(100%-4rem)] overflow-y-auto p-5">
        <div className="text-[11px] font-medium text-[#9CA3AF] dark:text-[#6b7280]">{task.id}</div>
        <h3 className="mt-1 text-lg font-semibold leading-snug">{task.title}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={statusTone(task.status)}>{task.status}</Badge>
          <Badge tone={priorityTone(task.priority)}>{task.priority}优先级</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {[
            ['负责人', task.owner],
            ['部门', task.dept],
            ['到期', task.due],
            ['当前耗时', task.duration],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-2.5 dark:border-[#333] dark:bg-[#1a1a1a]">
              <div className="text-[#6B7280] dark:text-[#9ca3af]">{label}</div>
              <div className="mt-1 font-medium">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className="h-9 flex-1 rounded-[10px] bg-[#2563EB] text-xs font-medium text-white">
            确认完成
          </button>
          <button type="button" className="h-9 rounded-[10px] border border-[#E5E7EB] px-3 text-xs font-medium text-[#374151] dark:border-[#333] dark:text-[#d1d5db]">
            转派
          </button>
          <button type="button" className="h-9 rounded-[10px] border border-[#E5E7EB] px-3 text-xs font-medium text-[#374151] dark:border-[#333] dark:text-[#d1d5db]">
            更多
          </button>
        </div>

        <section className="mt-5">
          <h4 className="text-sm font-semibold">描述</h4>
          <p className="mt-2 text-sm leading-6 text-[#6B7280] dark:text-[#9ca3af]">补齐准入资料并确认法务意见，完成后进入财务验收节点。</p>
        </section>

        <section className="mt-5">
          <h4 className="text-sm font-semibold">评论</h4>
          <div className="mt-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm text-[#6B7280] dark:border-[#333] dark:bg-[#1a1a1a] dark:text-[#9ca3af]">
            @周岚 已补充营业执照，等待法务确认合同条款。
          </div>
        </section>

        <FlowTimeline />
        <DurationAnalysis />
      </div>
    </aside>
  );
}

function FlowTimeline() {
  const steps = [
    ['创建', '赵一 · 运营部', '09:18', '0.0h'],
    ['转派', '李然 · 法务部', '10:42', '1.4h'],
    ['退回', '陈默 · 采购中心', '13:08', '2.4h'],
    ['待确认', '周岚 · 采购中心', '15:26', '2.3h'],
  ];

  return (
    <section className="mt-5">
      <h4 className="text-sm font-semibold">流转时间线</h4>
      <div className="mt-3 space-y-3">
        {steps.map(([label, owner, time, cost], index) => (
          <div key={`${label}-${time}`} className="relative grid grid-cols-[18px_1fr_auto] gap-2">
            <span className="mt-1.5 size-2.5 rounded-full bg-[#2563EB]" />
            {index < steps.length - 1 && <span className="absolute left-[4.5px] top-5 h-8 w-px bg-[#E5E7EB] dark:bg-[#333]" />}
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9ca3af]">{owner}</div>
            </div>
            <div className="text-right text-xs">
              <div className="font-medium tabular-nums">{time}</div>
              <div className="mt-0.5 text-[#6B7280] dark:text-[#9ca3af]">停留 {cost}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DurationAnalysis() {
  return (
    <section className="mt-5">
      <h4 className="text-sm font-semibold">耗时分析</h4>
      <div className="mt-3 space-y-3">
        {[
          ['负责人', '3.8h', '56%'],
          ['部门', '2.9h', '42%'],
          ['状态', '1.4h', '22%'],
        ].map(([label, value, width]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs text-[#6B7280] dark:text-[#9ca3af]">
              <span>{label}停留</span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-[#E5E7EB] dark:bg-[#333]">
              <div className="h-2 rounded-full bg-[#2563EB]" style={{ width }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskCreateDrawer({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-[360px] border-l border-[#E5E7EB] bg-white shadow-[0_0_32px_rgba(17,24,39,0.10)] dark:border-[#333] dark:bg-[#222] dark:shadow-[0_0_32px_rgba(0,0,0,0.3)]">
      <div className="flex h-14 items-center justify-between border-b border-[#E5E7EB] px-4 dark:border-[#333]">
        <span className="text-sm font-semibold">新建任务</span>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[9px] text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9ca3af] dark:hover:bg-[#333]" aria-label="关闭新建任务">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="p-4">
        {[
          ['任务标题', '请输入任务标题'],
          ['负责人', '选择负责人'],
          ['所属部门', '选择部门'],
          ['到期时间', '选择时间'],
        ].map(([label, placeholder]) => (
          <label key={label} className="mb-4 block">
            <span className="text-xs font-medium text-[#374151] dark:text-[#d1d5db]">{label}</span>
            <div className="mt-1 flex h-10 items-center rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-sm text-[#9CA3AF] dark:border-[#333] dark:bg-[#1a1a1a] dark:text-[#6b7280]">
              {placeholder}
            </div>
          </label>
        ))}
        <button type="button" className="mt-2 flex h-10 w-full items-center justify-between rounded-[10px] border border-[#E5E7EB] px-3 text-sm font-medium text-[#374151]">
          高级字段
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        <button type="button" className="mt-5 h-10 w-full rounded-[10px] bg-[#2563EB] text-sm font-medium text-white">
          创建任务
        </button>
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-y border-line bg-white dark:border-[#333] dark:bg-[#222]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <p className="reveal text-center text-sm font-medium text-graphite/[0.56] dark:text-[#a0a0a0]/[0.56]">
          为需要跨人员、跨单位协同的管理团队设计
        </p>
        <div className="reveal mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {trustUnits.map((unit) => (
            <div
              key={unit}
              className="flex h-14 items-center justify-center rounded-md border border-line bg-porcelain text-sm font-semibold text-graphite/[0.68] dark:border-[#333] dark:bg-[#1a1a1a] dark:text-[#a0a0a0]/[0.68]"
            >
              {unit}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductSuite() {
  const [active, setActive] = useState(0);
  const activeProduct = productTiles[active];
  const ActiveIcon = activeProduct.icon;

  return (
    <section id="products" className="bg-porcelain py-24 sm:py-32 dark:bg-[#111315]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold text-teal">产品矩阵</p>
          <h2 className="text-balance text-4xl font-semibold leading-tight sm:text-6xl">
            一个工作空间，装下任务流转的所有关键对象。
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {productTiles.map((product, index) => (
            <button
              key={product.title}
              type="button"
              onClick={() => setActive(index)}
              className={`reveal min-h-[190px] rounded-lg border p-5 text-left transition hover:-translate-y-1 ${
                active === index ? `${product.tint} shadow-soft` : 'border-line bg-white hover:border-ink/[0.18] dark:border-[#333] dark:bg-[#222] dark:hover:border-[#444]'
              }`}
              aria-pressed={active === index}
            >
              <product.icon size={24} aria-hidden="true" />
              <h3 className="mt-5 text-xl font-semibold">{product.title}</h3>
              <p className="mt-3 text-sm leading-6 text-graphite/[0.68] dark:text-[#a0a0a0]/[0.68]">{product.desc}</p>
            </button>
          ))}
        </div>

        <div className="reveal mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-line dark:border-[#333] dark:bg-[#222]">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
            <div className="border-b border-line p-6 lg:border-b-0 lg:border-r dark:border-[#333]">
              <div className={`inline-grid size-11 place-items-center rounded-md border ${activeProduct.tint}`}>
                <ActiveIcon size={22} aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-3xl font-semibold">{activeProduct.title}</h3>
              <p className="mt-4 max-w-md text-base leading-7 text-graphite/[0.70] dark:text-[#a0a0a0]/[0.70]">
                {activeProduct.desc} 管理者可以从这一层继续下钻到负责人、单位、状态和时长明细。
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {['负责人', '单位', '状态', '耗时', 'SLA'].map((tag) => (
                  <span key={tag} className="rounded-full border border-line bg-porcelain px-3 py-1 text-xs text-graphite/[0.62] dark:border-[#333] dark:bg-[#1a1a1a] dark:text-[#a0a0a0]/[0.62]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 bg-mist p-5 sm:grid-cols-2 dark:bg-[#1a1a1a]">
              {[
                ['待我处理', '23', '比昨日 -18%'],
                ['单位积压', '128', '采购中心最高'],
                ['状态变更', '486', '本周累计'],
                ['临界超时', '17', '34 分钟内需处理'],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-md border border-line bg-white p-5 dark:border-[#333] dark:bg-[#222]">
                  <div className="text-sm text-graphite/[0.55] dark:text-[#a0a0a0]/[0.55]">{label}</div>
                  <div className="mt-4 text-4xl font-semibold tabular-nums">{value}</div>
                  <div className="mt-3 text-xs text-graphite/[0.52]">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GoalStrip() {
  return (
    <section className="relative border-y border-line bg-white dark:border-[#333] dark:bg-[#222]">
      <div className="mx-auto grid max-w-7xl divide-y divide-line px-5 sm:px-8 lg:grid-cols-5 lg:divide-x lg:divide-y-0 lg:px-8 dark:divide-[#333]">
        {goals.map((goal) => (
          <div key={goal.title} className="reveal px-0 py-7 lg:px-5">
            <goal.icon size={20} className="mb-5 text-teal" aria-hidden="true" />
            <div className="text-3xl font-semibold tabular-nums">{goal.stat}</div>
            <div className="mt-1 text-xs font-medium uppercase text-graphite/[0.42] dark:text-[#a0a0a0]/[0.42]">{goal.label}</div>
            <p className="mt-4 text-sm leading-6 text-graphite/[0.64] dark:text-[#a0a0a0]/[0.64]">{goal.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="bg-porcelain py-24 sm:py-32 dark:bg-[#111315]">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="reveal lg:sticky lg:top-28 lg:h-fit">
          <p className="mb-4 text-sm font-semibold text-teal">功能介绍</p>
          <h2 className="max-w-md text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            用一条清晰的链路管理所有任务变化。
          </h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-graphite/[0.70] dark:text-[#a0a0a0]/[0.70]">
            不是把任务堆进列表，而是把每次交接、每次等待、每次完成都变成可追踪的数据。
          </p>
        </div>

        <div className="reveal border-t border-line dark:border-[#333]">
          {featureRows.map((feature) => (
            <div
              key={feature.number}
              className="group grid gap-6 border-b border-line py-8 transition sm:grid-cols-[84px_1fr] dark:border-[#333]"
            >
              <div className="text-sm font-medium text-graphite/[0.44] dark:text-[#a0a0a0]/[0.44]">{feature.number}</div>
              <div>
                <div className="flex items-start justify-between gap-5">
                  <h3 className="text-2xl font-semibold">{feature.title}</h3>
                  <ArrowRight
                    size={20}
                    className="mt-1 shrink-0 text-graphite/30 transition group-hover:translate-x-1 group-hover:text-teal"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-4 max-w-2xl text-base leading-7 text-graphite/[0.70] dark:text-[#a0a0a0]/[0.70]">{feature.desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {feature.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-graphite/[0.62] dark:border-[#333] dark:bg-[#222] dark:text-[#a0a0a0]/[0.62]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutomationLayer() {
  return (
    <section className="bg-white py-24 sm:py-32 dark:bg-[#222]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold text-teal">FlowDesk AI</p>
            <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
              不只记录流转，也能主动推动流转。
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-graphite/[0.70] dark:text-[#a0a0a0]/[0.70]">
            从状态历史、负责人负载和单位处理效率中提取信号，自动给出分派、催办和复盘建议。
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {automations.map((item) => (
            <div key={item.title} className="reveal rounded-lg border border-line bg-porcelain p-6 dark:border-[#333] dark:bg-[#1a1a1a]">
              <div className="mb-8 inline-grid size-11 place-items-center rounded-md bg-ink text-white dark:bg-[#f4f4f5] dark:text-ink">
                <item.icon size={22} aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-semibold">{item.title}</h3>
              <p className="mt-4 text-sm leading-6 text-graphite/[0.68] dark:text-[#a0a0a0]/[0.68]">{item.copy}</p>
            </div>
          ))}
        </div>

        <div className="reveal mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-line bg-[#f7f1e8] p-6 dark:border-[#3a3020] dark:bg-[#2a2018]">
            <div className="flex items-center gap-3">
              <BrainCircuit size={24} className="text-[#8a5a2c] dark:text-[#c9a07a]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#8a5a2c] dark:text-[#c9a07a]">智能复盘</span>
            </div>
            <p className="mt-6 max-w-2xl text-2xl font-semibold leading-snug">
              “本周 41% 的超时来自跨单位退回，采购中心等待法务确认的平均停留时间最高。”
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['退回率异常', '单位等待', '负责人负载', 'SLA 风险'].map((tag) => (
                <span key={tag} className="rounded-full bg-white/[0.62] px-3 py-1 text-xs text-graphite/[0.64] dark:bg-[#222]/[0.62] dark:text-[#a0a0a0]/[0.64]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-ink p-6 text-white">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold">下一个动作</span>
              <Sparkles size={18} className="text-teal" aria-hidden="true" />
            </div>
            {[
              ['通知负责人', '陈默 · 采购异常复核'],
              ['升级主管', '客户资料补正已退回 2 次'],
              ['生成周报', '发送给运营负责人'],
            ].map(([title, desc]) => (
              <div key={title} className="border-t border-white/[0.12] py-4">
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs text-white/[0.54]">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="bg-ink py-24 text-white sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold text-teal">产品界面展示</p>
            <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
              管理者看到结论，执行者看到下一步。
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-white/[0.62]">
            一个工作台同时覆盖任务流转、状态记录、时长统计和组织效率。
          </p>
        </div>

        <div className="reveal overflow-hidden rounded-lg border border-white/[0.12] bg-[#20201e] shadow-soft">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-md bg-white text-sm font-semibold text-ink">F</span>
              <span className="text-sm font-medium text-white/[0.84]">组织任务总览</span>
            </div>
            <div className="hidden items-center gap-2 text-xs text-white/[0.48] sm:flex">
              <span>今日 18:40 更新</span>
              <span className="size-1 rounded-full bg-white/30" />
              <span>华东运营中心</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[240px_1fr]">
            <aside className="hidden border-r border-white/10 bg-white/[0.03] p-5 lg:block">
              {[
                ['管理看板', BarChart3],
                ['任务流转', Workflow],
                ['责任人视图', Users],
                ['单位统计', Building2],
                ['状态历史', FileClock],
              ].map(([label, Icon], index) => (
                <div
                  key={label}
                  className={`mb-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                    index === 0 ? 'bg-white text-ink' : 'text-white/[0.58]'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </div>
              ))}
            </aside>

            <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
              <div className="p-4 sm:p-6">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ['待处理', '128', '+12', 'bg-teal'],
                    ['超时', '17', '-4', 'bg-coral'],
                    ['平均停留', '6.8h', '-21%', 'bg-amber'],
                    ['完成率', '91%', '+8%', 'bg-violet'],
                  ].map(([label, value, change, dot]) => (
                    <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between text-xs text-white/[0.45]">
                        <span>{label}</span>
                        <span className={`size-2 rounded-full ${dot}`} />
                      </div>
                      <div className="mt-4 flex items-end justify-between">
                        <span className="text-2xl font-semibold tabular-nums">{value}</span>
                        <span className="text-xs text-white/[0.48]">{change}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-sm font-medium">高优先级流转</span>
                    <span className="rounded-full bg-coral/15 px-2.5 py-1 text-xs text-[#ffb4aa]">5 个临界超时</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs text-white/40">
                        <tr className="border-b border-white/10">
                          <th className="px-4 py-3 font-medium">任务</th>
                          <th className="px-4 py-3 font-medium">负责人</th>
                          <th className="px-4 py-3 font-medium">当前单位</th>
                          <th className="px-4 py-3 font-medium">状态</th>
                          <th className="px-4 py-3 font-medium">停留</th>
                        </tr>
                      </thead>
                      <tbody className="text-white/[0.74]">
                        {[
                          ['采购异常复核', '陈默', '采购中心', '待审批', '9.2h'],
                          ['客户资料补正', '许宁', '客户成功部', '退回中', '6.5h'],
                          ['合同验收确认', '林舟', '法务部', '验收中', '2.8h'],
                          ['设备维修派单', '孟青', '资产部', '处理中', '1.9h'],
                        ].map((row) => (
                          <tr key={row[0]} className="border-b border-white/10 last:border-b-0">
                            {row.map((cell, index) => (
                              <td key={cell} className={`px-4 py-4 ${index === 0 ? 'font-medium text-white' : ''}`}>
                                {index === 3 ? (
                                  <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs">{cell}</span>
                                ) : (
                                  cell
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 p-4 sm:p-6 xl:border-l xl:border-t-0">
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium">状态历史</span>
                    <History size={16} className="text-white/[0.42]" aria-hidden="true" />
                  </div>
                  <div className="space-y-5">
                    {[
                      ['创建', '运营部 / 赵一', '09:18'],
                      ['转派', '法务部 / 林舟', '10:42'],
                      ['退回', '采购中心 / 陈默', '13:08'],
                      ['协办', '财务部 / 周岚', '15:26'],
                    ].map((item, index) => (
                      <div key={item[0]} className="relative grid grid-cols-[18px_1fr_auto] gap-3">
                        <span className="mt-1 size-2.5 rounded-full bg-teal" />
                        {index < 3 && <span className="absolute left-[4.5px] top-5 h-8 w-px bg-white/[0.12]" />}
                        <div>
                          <div className="text-sm font-medium">{item[0]}</div>
                          <div className="mt-1 text-xs text-white/[0.48]">{item[1]}</div>
                        </div>
                        <span className="text-xs text-white/[0.42] tabular-nums">{item[2]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium">单位停留排行</span>
                    <Clock3 size={16} className="text-white/[0.42]" aria-hidden="true" />
                  </div>
                  {[
                    ['采购中心', '38h', 'w-[86%]', 'bg-coral'],
                    ['法务部', '24h', 'w-[58%]', 'bg-amber'],
                    ['运营部', '13h', 'w-[34%]', 'bg-teal'],
                  ].map(([unit, hours, width, color]) => (
                    <div key={unit} className="mb-4 last:mb-0">
                      <div className="mb-2 flex justify-between text-xs text-white/[0.55]">
                        <span>{unit}</span>
                        <span className="tabular-nums">{hours}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.08]">
                        <div className={`h-2 rounded-full ${width} ${color}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Management() {
  return (
    <section className="bg-white py-24 sm:py-32 dark:bg-[#222]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div className="reveal">
          <p className="mb-4 text-sm font-semibold text-teal">管理者视角</p>
          <h2 className="max-w-xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            从任务列表，升级成组织效率仪表盘。
          </h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            {[
              [ShieldCheck, '责任闭环', '每次交接都保留负责人和单位快照。'],
              [Clock3, '超时预警', '按 SLA、状态和单位自动识别风险。'],
              [Layers3, '单位效率', '比较不同单位的处理时长与完成质量。'],
              [BarChart3, '完成分析', '按周期、类型和负责人拆解完成情况。'],
            ].map(([Icon, title, desc]) => (
              <div key={title} className="border-t border-line pt-5">
                <Icon size={22} className="mb-4 text-ink" aria-hidden="true" />
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-graphite/[0.68]">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal rounded-lg border border-line bg-mist p-4 sm:p-6">
          <div className="rounded-md bg-white p-5 shadow-line">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">本周效率报告</div>
                <div className="mt-1 text-xs text-graphite/[0.52]">按处理人、单位、状态聚合</div>
              </div>
              <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">健康</span>
            </div>
            <div className="space-y-4">
              {[
                ['人员平均处理', '5.6h', '72%'],
                ['单位平均停留', '8.2h', '62%'],
                ['状态等待占比', '18%', '34%'],
                ['超时任务下降', '21%', '78%'],
              ].map(([label, value, width]) => (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-graphite/[0.70]">{label}</span>
                    <span className="font-semibold tabular-nums">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-line">
                    <div className="h-2 rounded-full bg-ink" style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              [Fingerprint, '审计', '可追溯'],
              [ClipboardCheck, '验收', '可闭环'],
              [MessageSquareText, '催办', '可记录'],
              [FileCheck2, '归档', '可复盘'],
            ].map(([Icon, label, value]) => (
              <div key={label} className="rounded-md border border-line bg-white p-4">
                <Icon size={18} className="mb-3 text-teal" aria-hidden="true" />
                <div className="text-sm font-semibold">{label}</div>
                <div className="mt-1 text-xs text-graphite/[0.52]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Savings({ teamSize, setTeamSize }) {
  const metrics = useMemo(() => {
    const weeklyHours = Math.round(teamSize * 1.8);
    const yearlyHours = weeklyHours * 48;
    const days = Math.round(yearlyHours / 8);
    return { weeklyHours, yearlyHours, days };
  }, [teamSize]);

  return (
    <section className="bg-[#f7f1e8] py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="reveal">
          <p className="mb-4 text-sm font-semibold text-[#8a5a2c]">效率计算</p>
          <h2 className="max-w-lg text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            更少催办会议，更多任务完成。
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-graphite/[0.70]">
            通过自动分派、超时提醒和状态账本，团队不用再靠群消息追问任务进展。
          </p>
        </div>
        <div className="reveal rounded-lg border border-[#eadbc4] bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-sm font-semibold">团队规模</div>
              <div className="mt-1 text-sm text-graphite/[0.56]">估算每周减少的追问与协调时间</div>
            </div>
            <div className="text-4xl font-semibold tabular-nums">{teamSize}</div>
          </div>
          <input
            type="range"
            min="20"
            max="300"
            step="10"
            value={teamSize}
            onChange={(event) => setTeamSize(Number(event.target.value))}
            className="mt-8 h-2 w-full cursor-pointer accent-ink"
            aria-label="团队规模"
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['每周节省', `${metrics.weeklyHours}h`],
              ['每年节省', `${metrics.yearlyHours}h`],
              ['折合工作日', `${metrics.days}天`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-mist p-4">
                <div className="text-xs text-graphite/[0.52]">{label}</div>
                <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="bg-porcelain py-24 sm:py-32 dark:bg-[#111315]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="mb-4 text-sm font-semibold text-teal">价格区</p>
          <h2 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            从小团队到集团单位，都能按组织复杂度启用。
          </h2>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {pricing.map((plan) => (
            <div
              key={plan.name}
              className={`reveal rounded-lg border p-6 ${
                plan.featured ? 'border-ink bg-ink text-white shadow-soft dark:border-[#f4f4f5] dark:bg-[#f4f4f5] dark:text-ink' : 'border-line bg-white dark:border-[#333] dark:bg-[#222]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.featured && <span className="rounded-full bg-white/[0.12] px-3 py-1 text-xs dark:bg-[#111315]/[0.12]">推荐</span>}
              </div>
              <div className="mt-7 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-normal">{plan.price}</span>
                <span className={`pb-1 text-sm ${plan.featured ? 'text-white/[0.54] dark:text-ink/[0.54]' : 'text-graphite/[0.52] dark:text-[#a0a0a0]/[0.52]'}`}>{plan.unit}</span>
              </div>
              <p className={`mt-4 min-h-14 text-sm leading-6 ${plan.featured ? 'text-white/[0.62] dark:text-ink/[0.62]' : 'text-graphite/[0.68] dark:text-[#a0a0a0]/[0.68]'}`}>
                {plan.desc}
              </p>
              <a
                href="#cta"
                className={`mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  plan.featured
                    ? 'bg-white text-ink focus:ring-white focus:ring-offset-ink dark:bg-[#111315] dark:text-[#f4f4f5] dark:focus:ring-[#111315] dark:focus:ring-offset-[#f4f4f5]'
                    : 'border border-line bg-porcelain text-ink focus:ring-ink focus:ring-offset-white dark:border-[#333] dark:bg-[#1a1a1a] dark:text-[#f4f4f5] dark:focus:ring-[#f4f4f5] dark:focus:ring-offset-[#222]'
                }`}
              >
                选择方案
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <div className={`mt-7 border-t pt-6 ${plan.featured ? 'border-white/[0.12] dark:border-[#111315]/[0.12]' : 'border-line dark:border-[#333]'}`}>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <Check size={16} className="mt-0.5 text-teal" aria-hidden="true" />
                      <span className={plan.featured ? 'text-white/[0.74] dark:text-ink/[0.74]' : 'text-graphite/[0.76] dark:text-[#a0a0a0]/[0.76]'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ activeFaq, setActiveFaq }) {
  return (
    <section id="faq" className="bg-white py-24 sm:py-32 dark:bg-[#222]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="reveal">
          <p className="mb-4 text-sm font-semibold text-teal">FAQ</p>
          <h2 className="max-w-md text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            管理复杂任务前，先把关键问题说清楚。
          </h2>
        </div>
        <div className="reveal border-t border-line dark:border-[#333]">
          {faqs.map((faq, index) => {
            const open = activeFaq === index;
            return (
              <div key={faq.q} className="border-b border-line dark:border-[#333]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  onClick={() => setActiveFaq(open ? -1 : index)}
                  aria-expanded={open}
                >
                  <span className="text-lg font-semibold">{faq.q}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-graphite/50 transition ${open ? 'rotate-180' : ''} dark:text-[#a0a0a0]/50`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-2xl pb-6 text-base leading-7 text-graphite/[0.70] dark:text-[#a0a0a0]/[0.70]">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="bg-porcelain px-5 py-20 sm:px-8 dark:bg-[#111315]">
      <div className="reveal mx-auto max-w-7xl overflow-hidden rounded-lg bg-ink text-white dark:bg-[#f4f4f5] dark:text-ink">
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_0.8fr] lg:p-14">
          <div>
            <p className="mb-4 text-sm font-semibold text-teal">开始搭建任务流转闭环</p>
            <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-tight sm:text-5xl">
              让每个任务从“谁在处理”到“哪里耗时”都有答案。
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:hello@flowdesk.cn"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-medium text-ink transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-ink dark:bg-[#111315] dark:text-[#f4f4f5] dark:focus:ring-[#111315] dark:focus:ring-offset-[#f4f4f5]"
              >
                预约产品演示
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a
                href="#pricing"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/[0.16] px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/[0.08] dark:border-[#111315]/[0.16] dark:text-ink dark:hover:bg-[#111315]/[0.08]"
              >
                查看部署方案
              </a>
            </div>
          </div>
          <div className="rounded-md border border-white/[0.12] bg-white/[0.04] p-5 dark:border-[#111315]/[0.12] dark:bg-[#111315]/[0.04]">
            <div className="mb-5 flex items-center justify-between text-sm">
              <span className="font-medium">本月改善</span>
              <span className="text-white/[0.42] dark:text-ink/[0.42]">FlowDesk Insight</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['积压下降', '31%'],
                ['超时下降', '24%'],
                ['流转提速', '42%'],
                ['完成提升', '18%'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-white/[0.08] p-4 dark:bg-[#111315]/[0.08]">
                  <div className="text-xs text-white/[0.44] dark:text-ink/[0.44]">{label}</div>
                  <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white dark:border-[#333] dark:bg-[#222]">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-8 text-sm text-graphite/[0.56] sm:px-8 md:flex-row md:items-center dark:text-[#a0a0a0]/[0.56]">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-ink text-[13px] font-semibold text-white dark:bg-[#f4f4f5] dark:text-ink">F</span>
          <span>FlowDesk 任务流转中枢</span>
        </div>
        <div className="flex flex-wrap gap-5">
          <a href="#products" className="transition hover:text-ink dark:hover:text-[#f4f4f5]">
            产品
          </a>
          <a href="#features" className="transition hover:text-ink dark:hover:text-[#f4f4f5]">
            功能
          </a>
          <a href="#showcase" className="transition hover:text-ink dark:hover:text-[#f4f4f5]">
            界面
          </a>
          <a href="#pricing" className="transition hover:text-ink dark:hover:text-[#f4f4f5]">
            价格
          </a>
          <a href="#faq" className="transition hover:text-ink dark:hover:text-[#f4f4f5]">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}

export default App;
