import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import { auth } from '@appdeploy/client';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Edit2,
  Eye,
  FileBarChart,
  Filter,
  Home,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Sun,
  Tag,
  UserRound,
  PieChart,
  Receipt,
  AlertCircle,
} from 'lucide-react';

type Kind = 'transactions' | 'categories' | 'budgets' | 'goals' | 'profile';
type Tx = {
  id: string;
  kind: 'expense' | 'income';
  amount: number;
  category: string;
  date: string;
  title?: string;
  description: string;
};
type Category = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
};
type Budget = { id: string; month: string; amount: number; alertedThresholds?: number[] };
type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;
};
type Profile = {
  id: string;
  name: string;
  email: string;
  institution: string;
  currency: string;
};
const defaults: Category[] = [
  {
    id: 'cat-food',
    name: 'Food',
    type: 'expense',
    color: '#8b5cf6',
    icon: '🍔',
  },
  {
    id: 'cat-transport',
    name: 'Transportation',
    type: 'expense',
    color: '#0ea5e9',
    icon: '🚌',
  },
  {
    id: 'cat-education',
    name: 'Education',
    type: 'expense',
    color: '#f59e0b',
    icon: '📚',
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    type: 'expense',
    color: '#ec4899',
    icon: '🛍️',
  },
  {
    id: 'cat-bills',
    name: 'Utilities',
    type: 'expense',
    color: '#64748b',
    icon: '💡',
  },
  {
    id: 'cat-health',
    name: 'Healthcare',
    type: 'expense',
    color: '#10b981',
    icon: '💊',
  },
  {
    id: 'cat-entertainment',
    name: 'Entertainment',
    type: 'expense',
    color: '#f97316',
    icon: '🎬',
  },
  {
    id: 'cat-accommodation',
    name: 'Accommodation',
    type: 'expense',
    color: '#14b8a6',
    icon: '🏠',
  },
  {
    id: 'cat-other',
    name: 'Other',
    type: 'expense',
    color: '#94a3b8',
    icon: '📦',
  },
  {
    id: 'cat-salary',
    name: 'Allowance / Salary',
    type: 'income',
    color: '#10b981',
    icon: '💵',
  },
  {
    id: 'cat-freelance',
    name: 'Freelance',
    type: 'income',
    color: '#0ea5e9',
    icon: '💻',
  },
];
const money = (n: number, currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n || 0);
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthNow = () => localDateKey(new Date()).slice(0, 7);
const dateNow = () => localDateKey(new Date());
const shiftMonth = (value: string, offset: number) => {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const uid = () => crypto.randomUUID();
const monthLabel = (m: string) =>
  new Date(m + '-02').toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  });
const colors = [
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#f97316',
  '#64748b',
  '#14b8a6',
];

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [view, setView] = useState('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaults);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profile, setProfile] = useState<Profile>({
    id: 'profile',
    name: '',
    email: '',
    institution: '',
    currency: 'PKR',
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [onboardingName, setOnboardingName] = useState('');
  const [month, setMonth] = useState(monthNow());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All categories');
  const [filterType, setFilterType] = useState('All types');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [modal, setModal] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const alertInFlight = useRef('');
  const mutationInFlight = useRef(false);

  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(''), 2600);
  };
  const call = async (
    path: string,
    method: 'get' | 'post' | 'put' | 'delete' = 'get',
    body?: any
  ) => {
    const r =
      method === 'get'
        ? await api.get(path)
        : method === 'post'
          ? await api.post(path, body)
          : method === 'put'
            ? await api.put(path, body)
            : await api.delete(path);
    return r.data;
  };
  const refresh = async () => {
    const d = await call('/api/bootstrap');
    setHasProfile(!!d.profile);
    if (d.incomplete?.length) setErrorMsg('Some records are not shown because this account has more than 500 items in: ' + d.incomplete.join(', ') + '. Contact support before relying on full-history totals.');
    setTransactions(d.transactions || []);
    setCategories([
      ...(d.categories || []),
      ...defaults.filter(
        x => !(d.categories || []).some((c: Category) => c.id === x.id)
      ),
    ]);
    setBudgets(d.budgets || []);
    setGoals(d.goals || []);
    setProfile(
      d.profile || {
        id: 'profile',
        name: user?.name || '',
        email: user?.email || '',
        institution: '',
        currency: 'PKR',
      }
    );
  };
  useEffect(() => {
    (async () => {
      try {
        const u = await auth.getUser();
        setUser(u);
        if (u) {
          const d = await call('/api/bootstrap');
          setHasProfile(!!d.profile);
          if (d.incomplete?.length) setErrorMsg('Some records are not shown because this account has more than 500 items in: ' + d.incomplete.join(', ') + '. Contact support before relying on full-history totals.');
          setTransactions(d.transactions || []);
          setCategories([
            ...(d.categories || []),
            ...defaults.filter(
              x => !(d.categories || []).some((c: Category) => c.id === x.id)
            ),
          ]);
          setBudgets(d.budgets || []);
          setGoals(d.goals || []);
          setProfile(
            d.profile || {
              id: 'profile',
              name: u.name || '',
              email: u.email || '',
              institution: '',
              currency: 'PKR',
            }
          );
        }
      } catch (e: any) {
        setErrorMsg(e.message || 'Unable to load your account. Please retry.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const currentTx = useMemo(() => transactions.filter(t => t.date.startsWith(month)), [transactions, month]);
  const expenses = useMemo(() => currentTx.filter(t => t.kind === 'expense'), [currentTx]);
  const income = useMemo(() => currentTx.filter(t => t.kind === 'income'), [currentTx]);
  const totalExpense = useMemo(() => expenses.reduce((s, t) => s + t.amount, 0), [expenses]);
  const totalIncome = useMemo(() => income.reduce((s, t) => s + t.amount, 0), [income]);
  const totalSaved = useMemo(() => goals.reduce((sum, goal) => sum + goal.saved, 0), [goals]);
  const currentBudget = useMemo(() => budgets.find(b => b.month === month), [budgets, month]);
  const budget = currentBudget?.amount || 0;
  const remaining = budget - totalExpense;
  const utilization = budget ? (totalExpense / budget) * 100 : 0;
  const progressWidth = Math.min(utilization, 100);
  const budgetStatus = !budget ? 'unset' : utilization >= 100 ? 'exceeded' : utilization >= 75 ? 'approaching' : 'normal';
  const filtered = useMemo(
    () =>
      transactions.filter(
        t =>
          ((t.title || t.description) + ' ' + t.description + ' ' + t.category)
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filterCategory === 'All categories' ||
            t.category === filterCategory) &&
          (filterType === 'All types' || t.kind === filterType) &&
          (dateFrom === '' || t.date >= dateFrom) &&
          (dateTo === '' || t.date <= dateTo) &&
          (amountMin === '' || t.amount >= Number(amountMin)) &&
          (amountMax === '' || t.amount <= Number(amountMax))
      ),
    [
      transactions,
      search,
      filterCategory,
      filterType,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
    ]
  );
  const categoryTotals = useMemo(() => categories
    .filter(c => c.type === 'expense')
    .map(c => ({
      ...c,
      total: expenses.filter(t => t.category === c.name).reduce((s, t) => s + t.amount, 0),
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total), [categories, expenses]);
  const maxDay = Math.max(
    1,
    ...Array.from({ length: 12 }, (_, i) =>
      transactions
        .filter(
          t =>
            t.kind === 'expense' &&
            t.date.startsWith(
              monthNow().slice(0, 4) + '-' + String(i + 1).padStart(2, '0')
            )
        )
        .reduce((s, t) => s + t.amount, 0)
    )
  );
  const chartMonths = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(monthNow(), i - 5);
    const d = new Date(`${m}-02T12:00:00`);
    return {
      key: m,
      label: d.toLocaleDateString('en', { month: 'short' }),
      expense: transactions
        .filter(t => t.kind === 'expense' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0),
      income: transactions
        .filter(t => t.kind === 'income' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0),
    };
  }), [transactions]);
  const previousMonth = shiftMonth(month, -1);
  const previousSpend = useMemo(() => transactions.filter(t => t.kind === 'expense' && t.date.startsWith(previousMonth)).reduce((s, t) => s + t.amount, 0), [transactions, previousMonth]);
  const spendChange = previousSpend
    ? ((totalExpense - previousSpend) / previousSpend) * 100
    : 0;

  useEffect(() => {
    if (!currentBudget || !budget) return;
    const thresholds = [75, 90, 100];
    const alreadyAlerted = currentBudget.alertedThresholds || [];
    const reached = thresholds.filter(value => utilization >= value && !alreadyAlerted.includes(value));
    if (!reached.length) return;
    const lock = month + ':' + currentBudget.id;
    if (alertInFlight.current === lock) return;
    alertInFlight.current = lock;
    call('/api/budgets/' + encodeURIComponent(currentBudget.id) + '/alerts', 'post', { month }).then((result: any) => {
      const newlyReached: number[] = result.newlyAlerted || [];
      if (!newlyReached.length) return;
      const updatedThresholds = [...new Set([...alreadyAlerted, ...newlyReached])].sort((a, b) => a - b);
      setBudgets(previous => previous.map(item => item.id === currentBudget.id ? { ...item, alertedThresholds: updatedThresholds } : item));
      notify('Budget alert: you have reached ' + newlyReached.map(value => value + '%').join(' and ') + ' of your ' + monthLabel(month) + ' budget.');
    }).catch((e: any) => {
      // A stale budget ID is handled as a no-op by the backend. Keep genuine
      // authorization/database failures visible without spamming the student.
      setErrorMsg(e.message || 'Could not save your budget alert state.');
    }).finally(() => {
      alertInFlight.current = '';
    });
  }, [month, budget, totalExpense, currentBudget?.id, currentBudget?.alertedThresholds?.join(',')]);

  const saveRecord = async (kind: Kind, data: any, id?: string) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setErrorMsg('');
    try {
      if (id && (kind !== 'profile' || hasProfile))
        await call(
          '/api/records/' + kind + '/' + encodeURIComponent(id),
          'put',
          data
        );
      else await call('/api/records/' + kind, 'post', data);
      await refresh();
      setModal('');
      setEditing(null);
      notify(id ? 'Changes saved' : 'Added successfully');
    } catch (e: any) {
      setErrorMsg(e.message || 'Could not save. Please try again.');
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };
  const removeRecord = async (kind: Kind, id: string) => {
    if (mutationInFlight.current || !window.confirm('Delete this item? This action cannot be undone.')) return;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      await call(
        '/api/records/' + kind + '/' + encodeURIComponent(id),
        'delete'
      );
      await refresh();
      notify('Deleted successfully');
    } catch (e: any) {
      setErrorMsg(e.message || 'Delete failed');
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };
  const openTx = (tx?: Tx) => {
    setEditing(tx || null);
    setForm(
      tx
        ? { ...tx }
        : {
            kind: 'expense',
            amount: '',
            category: 'Food',
            date: dateNow(),
            title: '',
            description: '',
          }
    );
    setErrorMsg('');
    setModal('transaction');
  };
  const openDetails = (tx: Tx) => {
    setEditing(tx);
    setErrorMsg('');
    setModal('details');
  };
  const openCategory = (category?: Category) => {
    setEditing(category || null);
    setForm(category ? { ...category } : { name: '', type: 'expense', color: colors[categories.length % colors.length], icon: '✨' });
    setErrorMsg('');
    setModal('category');
  };
  const categoryUsage = (category: Category) => transactions.filter(tx => tx.category === category.name).length;
  const openBudget = () => {
    const existing = budgets.find(b => b.month === month) || null;
    setEditing(existing);
    setForm({ month, amount: existing?.amount || '' });
    setErrorMsg('');
    setModal('budget');
  };
  const openGoal = (goal?: Goal) => {
    setEditing(goal || null);
    setForm(
      goal ? { ...goal } : { name: '', target: '', saved: '', deadline: '' }
    );
    setModal('goal');
  };
  const escapeHtml = (value: unknown) =>
    String(value ?? '').replace(/[&<>\"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      "'": '&#39;',
    })[character] || character);
  const csvCell = (value: unknown) => {
    const raw = String(value ?? '');
    const first = raw.trimStart().charAt(0);
    const safe = ['=', '+', '-', '@'].includes(first) ? "'" + raw : raw;
    return '\"' + safe.replaceAll('\"', '\"\"') + '\"';
  };
  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Category', 'Description', 'Amount'],
      ...filtered.filter(t => t.date.startsWith(month)).map(t => [
        t.date,
        t.kind,
        t.category,
        t.description,
        t.amount,
      ]),
    ];
    const csv = rows
      .map(r => r.map(csvCell).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'expensebuddy-' + month + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportPDF = () => {
    const rows = filtered.filter(t => t.date.startsWith(month));
    const w = window.open('', '_blank');
    if (!w) {
      notify('Allow pop-ups to print your PDF report');
      return;
    }
    w.document.write(
      '<html><head><title>ExpenseBuddy Report</title><style>body{font:14px Arial;padding:32px;color:#172033}h1{color:#202b52}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:20px;font-weight:bold}</style></head><body><h1>ExpenseBuddy</h1><h2>' +
        monthLabel(month) +
        ' report</h2><p class="total">Expenses: ' +
        money(
          rows
            .filter(t => t.kind === 'expense')
            .reduce((s, t) => s + t.amount, 0),
          profile.currency
        ) +
        '</p><table><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr>' +
        rows
          .map(
            t =>
              '<tr><td>' +
              escapeHtml(t.date) +
              '</td><td>' +
              escapeHtml(t.kind) +
              '</td><td>' +
              escapeHtml(t.category) +
              '</td><td>' +
              escapeHtml(t.description) +
              '</td><td>' +
              escapeHtml(money(t.amount, profile.currency)) +
              '</td></tr>'
          )
          .join('') +
        '</table><script>window.onload=()=>window.print()<\/script></body></html>'
    );
    w.document.close();
  };
  const signIn = async () => {
    setErrorMsg('');
    try {
      await auth.signInWithRedirect();
    } catch (e: any) {
      setErrorMsg(e.message || 'Sign in could not start. Please retry.');
    }
  };
  const signOut = async () => {
    await auth.signOut();
    setUser(null);
    setTransactions([]);
  };
  const navItems = [
    { name: 'Overview', icon: Home },
    { name: 'Transactions', icon: Receipt },
    { name: 'Categories', icon: Tag },
    { name: 'Budgets', icon: Wallet },
    { name: 'Analytics', icon: PieChart },
    { name: 'Reports', icon: FileBarChart },
    { name: 'Savings goals', icon: Target },
    { name: 'Profile', icon: UserRound },
    { name: 'Settings', icon: Settings },
  ];
  const changeMonth = (delta: number) => {
    const d = new Date(month + '-02');
    d.setMonth(d.getMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
  };
  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Wallet size={23} />
        </div>
        <p>Preparing your money space…</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth-page">
        <div className="auth-art">
          <div className="auth-brand">
            <div className="brand-mark">
              <Wallet />
            </div>
            <span>ExpenseBuddy</span>
          </div>
          <div className="auth-copy">
            <span className="eyebrow">YOUR MONEY, IN CONTROL</span>
            <h1>
              Make every rupee
              <br />
              work for <em>you.</em>
            </h1>
            <p>
              A calmer way to track spending, plan your monthly budget, and
              build savings habits while you study.
            </p>
            <div className="auth-mini">
              <div>
                <strong>Track</strong>
                <span>Daily spending</span>
              </div>
              <div>
                <strong>Plan</strong>
                <span>Monthly budgets</span>
              </div>
              <div>
                <strong>Grow</strong>
                <span>Savings goals</span>
              </div>
            </div>
          </div>
          <div className="auth-orbit orbit-one"></div>
          <div className="auth-orbit orbit-two"></div>
        </div>
        <div className="auth-panel">
          <div className="auth-form">
            <div className="mobile-brand">
              <div className="brand-mark">
                <Wallet />
              </div>
              ExpenseBuddy
            </div>
            <span className="eyebrow">WELCOME TO EXPENSEBUDDY</span>
            <h2>
              Take charge of
              <br />
              your finances.
            </h2>
            <p className="muted">
              Sign in securely with your email or an available identity provider to access your personal finance dashboard.
            </p>
            <button className="btn primary full" onClick={signIn}>
              Continue to secure sign in <ChevronRight size={17} />
            </button>
            <p className="field-hint">
              Email sign-in is managed by AppDeploy using a secure passwordless link. ExpenseBuddy never collects or stores your password.
            </p>
            {errorMsg && (
              <div className="error">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}
            <div className="secure-note">
              <ShieldCheck size={16} /> Your financial data is private and
              protected.
            </div>
            <div className="auth-foot">
              By continuing, you agree to use ExpenseBuddy responsibly. Account
              sign-in is managed securely by AppDeploy.
            </div>
          </div>
        </div>
      </div>
    );
  if (!profile.name?.trim())
    return (
      <div className="auth-page">
        <div className="auth-art">
          <div className="auth-brand">
            <div className="brand-mark"><Wallet /></div>
            <span>ExpenseBuddy</span>
          </div>
          <div className="auth-copy">
            <span className="eyebrow">STUDENT ACCOUNT SETUP</span>
            <h1>Make this money space <em>yours.</em></h1>
            <p>Add your name to finish setting up your student profile. Your verified sign-in identity stays managed by AppDeploy.</p>
          </div>
          <div className="auth-orbit orbit-one"></div>
          <div className="auth-orbit orbit-two"></div>
        </div>
        <div className="auth-panel">
          <form className="auth-form" onSubmit={e => {
            e.preventDefault();
            const name = onboardingName.trim();
            if (!name || name.length > 80) {
              setErrorMsg('Enter your full name (up to 80 characters).');
              return;
            }
            saveRecord('profile', {
              id: 'profile',
              name,
              email: user.email || '',
              institution: '',
              currency: 'PKR',
            }, hasProfile ? 'profile' : undefined);
          }}>
            <div className="mobile-brand">
              <div className="brand-mark"><Wallet /></div>
              ExpenseBuddy
            </div>
            <span className="eyebrow">CREATE YOUR STUDENT PROFILE</span>
            <h2>Welcome to ExpenseBuddy.</h2>
            <p className="muted">Your sign-in is verified. Complete your profile to continue.</p>
            <label>
              Full name
              <input required maxLength={80} autoComplete="name" value={onboardingName} onChange={e => setOnboardingName(e.target.value)} placeholder="Enter your full name" />
            </label>
            <label>
              Email address
              <input value={user.email || ''} disabled readOnly />
            </label>
            <p className="field-hint">Your email belongs to your authenticated identity and cannot be changed from this form. Email account uniqueness is enforced by the identity provider.</p>
            {errorMsg && <div className="error"><AlertCircle size={16} />{errorMsg}</div>}
            <button className="btn primary full" disabled={busy}>
              {busy ? 'Creating profile…' : 'Create student profile'}
            </button>
            <div className="secure-note"><ShieldCheck size={16} /> Your financial records are private to this signed-in account.</div>
          </form>
        </div>
      </div>
    );
  return (
    <div className={dark ? 'app-shell dark' : 'app-shell'}>
      <aside className={'sidebar ' + (mobileOpen ? 'open' : '')}>
        <div className="side-brand">
          <div className="brand-mark">
            <Wallet size={20} />
          </div>
          <span>
            Expense<span className="brand-purple">Buddy</span>
          </span>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {navItems.map(n => (
            <button
              key={n.name}
              className={'nav-link ' + (view === n.name ? 'active' : '')}
              onClick={() => {
                setView(n.name);
                setMobileOpen(false);
              }}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.name === 'Transactions' && (
                <small>{transactions.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card">
            <div className="tip-icon">
              <Sparkles size={17} />
            </div>
            <strong>Small steps add up.</strong>
            <p>Track today. Thank yourself later.</p>
          </div>
          <button className="nav-link" onClick={() => setView('Settings')}>
            <Settings size={18} />
            Settings
          </button>
          <div className="user-mini">
            <div className="avatar">
              {(profile.name || user.name || user.email || 'S')
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div className="user-info">
              <strong>{profile.name || user.name || 'Student'}</strong>
              <span>{user.email || 'Personal account'}</span>
            </div>
            <button className="icon-btn" onClick={signOut} title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <div className="scrim" onClick={() => setMobileOpen(false)}></div>
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-btn menu-toggle"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </button>
            <div>
              <span className="breadcrumb">Workspace /</span>
              <strong>{view}</strong>
            </div>
          </div>
          <div className="top-actions">
            <div className="month-control">
              <button className="icon-btn" onClick={() => changeMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <span>{monthLabel(month)}</span>
              <button className="icon-btn" onClick={() => changeMonth(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
            <button
              className="icon-btn notification-toggle"
              onClick={() => notify(!budget ? 'No budget is set for ' + monthLabel(month) + '.' : budgetStatus === 'exceeded' ? 'Budget exceeded: spending is ' + utilization.toFixed(0) + '% of your limit.' : budgetStatus === 'approaching' ? 'Budget warning: you have used ' + utilization.toFixed(0) + '% of your limit.' : 'You’re on track with your ' + monthLabel(month) + ' budget.')}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {budget && utilization >= 75 && <i className="notification-dot" />}
            </button>
            <button
              className="icon-btn theme-toggle"
              onClick={() => setDark(!dark)}
              title="Toggle theme"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="avatar small">
              {(profile.name || user.name || 'S').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-content">
          {errorMsg && (
            <div className="error banner">
              <AlertCircle size={17} />
              {errorMsg}
              <button className="icon-btn" onClick={() => setErrorMsg('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === 'Overview' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR FINANCIAL SNAPSHOT</span>
                  <h1>
                    Good{' '}
                    {new Date().getHours() < 12
                      ? 'morning'
                      : new Date().getHours() < 18
                        ? 'afternoon'
                        : 'evening'}
                    , {(profile.name || user.name || 'there').split(' ')[0]}{' '}
                    <span>✦</span>
                  </h1>
                  <p>Here’s what’s happening with your money this month.</p>
                </div>
                <button className="btn primary" onClick={() => openTx()}>
                  <Plus size={17} /> Quick add expense
                </button>
              </div>
              <div className="stats-grid">
                <Stat
                  title="Total expenses"
                  value={money(totalExpense, profile.currency)}
                  note="Spent this month"
                  icon={ArrowUpRight}
                  tone="purple"
                />
                <Stat
                  title="Monthly income"
                  value={money(totalIncome, profile.currency)}
                  note="Received this month"
                  icon={ArrowDownLeft}
                  tone="green"
                />
                <Stat
                  title="Remaining budget"
                  value={
                    budget ? money(remaining, profile.currency) : 'Not set'
                  }
                  note={
                    budget
                      ? remaining < 0
                        ? 'You are over budget'
                        : 'Available to spend'
                      : 'Set a monthly limit'
                  }
                  icon={Wallet}
                  tone="blue"
                />
                <Stat
                  title="Savings"
                  value={money(totalSaved, profile.currency)}
                  note={goals.length ? goals.length + ' active savings goals' : 'Start your first savings goal'}
                  icon={Target}
                  tone="amber"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel spending-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Spending overview</h3>
                      <p>Income vs expenses over the last 6 months</p>
                    </div>
                    <span className="soft-pill">
                      <Activity size={13} /> Monthly
                    </span>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="legend-dot purple-dot"></i>Expenses
                    </span>
                    <span>
                      <i className="legend-dot green-dot"></i>Income
                    </span>
                  </div>
                  <div className="bar-chart">
                    {chartMonths.map(m => (
                      <div className="chart-col" key={m.key}>
                        <div className="bars">
                          <div
                            className="bar income-bar"
                            style={{
                              height:
                                (m.income /
                                  Math.max(
                                    1,
                                    ...chartMonths.flatMap(x => [
                                      x.income,
                                      x.expense,
                                    ])
                                  )) *
                                  145 +
                                'px',
                            }}
                            title={'Income ' + money(m.income)}
                          ></div>
                          <div
                            className="bar expense-bar"
                            style={{
                              height:
                                (m.expense /
                                  Math.max(
                                    1,
                                    ...chartMonths.flatMap(x => [
                                      x.income,
                                      x.expense,
                                    ])
                                  )) *
                                  145 +
                                'px',
                            }}
                            title={'Expenses ' + money(m.expense)}
                          ></div>
                        </div>
                        <span>{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-foot">
                    <div>
                      <span className="muted">This month</span>
                      <strong>{money(totalExpense, profile.currency)}</strong>
                    </div>
                    <div
                      className={
                        spendChange > 0 ? 'change negative' : 'change positive'
                      }
                    >
                      {previousSpend
                        ? (spendChange > 0 ? '+' : '') +
                          spendChange.toFixed(1) +
                          '% vs last month'
                        : 'No previous month data'}
                    </div>
                  </div>
                </section>
                <section className="panel budget-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Monthly budget</h3>
                      <p>Your spending limit</p>
                    </div>
                    <button className="text-btn" onClick={openBudget}>
                      {budget ? 'Edit' : 'Set budget'}
                    </button>
                  </div>
                  {budget ? (
                    <>
                      <div className="budget-number">
                        {money(totalExpense, profile.currency)}
                        <span> / {money(budget, profile.currency)}</span>
                      </div>
                      <div className="progress-track large">
                        <div
                          className={
                            'progress-fill ' +
                            (budgetStatus === 'exceeded' ? 'exceeded' : budgetStatus === 'approaching' ? 'warning' : '')
                          }
                          style={{ width: progressWidth + '%' }}
                        ></div>
                      </div>
                      <div className="progress-label">
                        <strong>{utilization.toFixed(0)}% used</strong>
                        <span>
                          {money(remaining, profile.currency)}{' '}
                          {remaining >= 0 ? 'left' : 'over'}
                        </span>
                      </div>
                      {budgetStatus !== 'normal' && (
                        <div className="budget-alert">
                          <Bell size={15} />
                          {budgetStatus === 'exceeded' ? 'Budget exceeded. You are spending beyond your monthly limit.' : 'You are approaching your monthly budget limit.'}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-inline">
                      <div className="empty-icon">
                        <Wallet />
                      </div>
                      <strong>No budget set yet</strong>
                      <p>Choose a monthly spending limit to stay on track.</p>
                      <button className="btn secondary" onClick={openBudget}>
                        Set monthly budget
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <div className="dashboard-grid lower-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Where your money goes</h3>
                      <p>Category breakdown for {monthLabel(month)}</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setView('Analytics')}
                    >
                      View details
                    </button>
                  </div>
                  {categoryTotals.length ? (
                    <>
                      <div className="donut-wrap">
                        <div
                          className="donut"
                          style={{
                            background:
                              'conic-gradient(' +
                              categoryTotals
                                .map(
                                  (c, i) =>
                                    c.color +
                                    ' ' +
                                    (categoryTotals
                                      .slice(0, i)
                                      .reduce((s, x) => s + x.total, 0) /
                                      totalExpense) *
                                      100 +
                                    '% ' +
                                    (categoryTotals
                                      .slice(0, i + 1)
                                      .reduce((s, x) => s + x.total, 0) /
                                      totalExpense) *
                                      100 +
                                    '%'
                                )
                                .join(',') +
                              ')',
                          }}
                        >
                          <div>
                            <strong>
                              {money(totalExpense, profile.currency)}
                            </strong>
                            <span>Total spent</span>
                          </div>
                        </div>
                        <div className="category-legend">
                          {categoryTotals.slice(0, 5).map(c => (
                            <div className="category-line" key={c.id}>
                              <span>
                                <i style={{ background: c.color }}></i>
                                {c.name}
                              </span>
                              <strong>
                                {money(c.total, profile.currency)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Empty text="Your category breakdown will appear after your first expense." />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Savings goals</h3>
                      <p>Keep moving towards what matters</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setView('Savings goals')}
                    >
                      See all
                    </button>
                  </div>
                  {goals.length ? (
                    goals.slice(0, 2).map(g => (
                      <div className="goal-mini" key={g.id}>
                        <div className="goal-top">
                          <div>
                            <strong>{g.name}</strong>
                            <span>
                              {money(g.saved, profile.currency)} of{' '}
                              {money(g.target, profile.currency)}
                            </span>
                          </div>
                          <span className="goal-percent">
                            {Math.min(100, (g.saved / g.target) * 100).toFixed(
                              0
                            )}
                            %
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill green-fill"
                            style={{
                              width:
                                Math.min(100, (g.saved / g.target) * 100) + '%',
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty text="Create a savings goal and track your progress here." />
                  )}
                  <button
                    className="btn secondary full"
                    onClick={() => openGoal()}
                  >
                    <Plus size={16} /> Create a savings goal
                  </button>
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="panel-head">
                  <div>
                    <h3>Recent transactions</h3>
                    <p>Your latest money activity</p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => setView('Transactions')}
                  >
                    View all transactions <ChevronRight size={15} />
                  </button>
                </div>
                <TransactionTable
                  items={[...currentTx]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5)}
                  currency={profile.currency}
                  onView={openDetails}
                  onEdit={openTx}
                  onDelete={t => removeRecord('transactions', t.id)}
                />
              </section>
            </>
          )}
          {view === 'Transactions' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MONEY IN, MONEY OUT</span>
                  <h1>Transactions</h1>
                  <p>Keep every rupee accounted for.</p>
                </div>
                <button className="btn primary" onClick={() => openTx()}>
                  <Plus size={17} /> Quick add expense
                </button>
              </div>
              <section className="panel">
                <div className="toolbar">
                  <div className="searchbox">
                    <Search size={17} />
                    <input
                      placeholder="Search description or category…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn secondary"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal size={16} /> Filters
                  </button>
                  <button className="btn secondary" onClick={exportCSV}>
                    <Download size={16} /> Export CSV
                  </button>
                </div>
                {showFilters && (
                  <div className="filters">
                    <select
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      <option>All categories</option>
                      {categories.map(c => (
                        <option key={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                    >
                      <option>All types</option>
                      <option value="expense">Expenses</option>
                      <option value="income">Income</option>
                    </select>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Min amount"
                      value={amountMin}
                      onChange={e => setAmountMin(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max amount"
                      value={amountMax}
                      onChange={e => setAmountMax(e.target.value)}
                    />
                    <button
                      className="text-btn"
                      onClick={() => {
                        setFilterCategory('All categories');
                        setFilterType('All types');
                        setDateFrom('');
                        setDateTo('');
                        setAmountMin('');
                        setAmountMax('');
                        setSearch('');
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
                <TransactionTable
                  items={[...filtered].sort((a, b) =>
                    b.date.localeCompare(a.date)
                  )}
                  currency={profile.currency}
                  onView={openDetails}
                  onEdit={openTx}
                  onDelete={t => removeRecord('transactions', t.id)}
                />
                <div className="table-foot">
                  {filtered.length} transaction
                  {filtered.length === 1 ? '' : 's'} found
                </div>
              </section>
            </>
          )}
          {view === 'Budgets' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PLAN WITH PURPOSE</span>
                  <h1>Monthly budgets</h1>
                  <p>Give your spending a healthy boundary.</p>
                </div>
                <button className="btn primary" onClick={openBudget}>
                  <Plus size={17} /> Set budget
                </button>
              </div>
              <div className="stats-grid">
                <Stat
                  title="Budget limit"
                  value={budget ? money(budget, profile.currency) : '—'}
                  note={monthLabel(month)}
                  icon={Wallet}
                  tone="blue"
                />
                <Stat
                  title="Spent so far"
                  value={money(totalExpense, profile.currency)}
                  note="Expenses this month"
                  icon={ArrowUpRight}
                  tone="purple"
                />
                <Stat
                  title="Available"
                  value={budget ? money(remaining, profile.currency) : '—'}
                  note={
                    budget && remaining < 0
                      ? 'Over budget'
                      : 'Remaining balance'
                  }
                  icon={CircleDollarSign}
                  tone="green"
                />
                <Stat
                  title="Utilization"
                  value={budget ? utilization.toFixed(0) + '%' : '—'}
                  note={budgetStatus === 'exceeded' ? 'Budget exceeded' : budgetStatus === 'approaching' ? 'Approaching limit' : budget ? 'Normal spending' : 'No budget configured'}
                  icon={Activity}
                  tone="amber"
                />
              </div>
              <section className="panel budget-detail">
                <div className="panel-head">
                  <div>
                    <h3>{monthLabel(month)} budget</h3>
                    <p>Monthly spending progress</p>
                  </div>
                  <button className="text-btn" onClick={openBudget}>
                    Edit budget
                  </button>
                </div>
                {budget ? (
                  <>
                    <div className="budget-number">
                      {money(totalExpense, profile.currency)}
                      <span> spent of {money(budget, profile.currency)}</span>
                    </div>
                    <div className="budget-status-row">
                      <span className={'budget-status ' + budgetStatus}>{budgetStatus === 'exceeded' ? 'Budget exceeded' : budgetStatus === 'approaching' ? 'Approaching limit' : 'Normal spending'}</span>
                      <span>{monthLabel(month)}</span>
                    </div>
                    <div className="progress-track large">
                      <div className={'progress-fill ' + (budgetStatus === 'exceeded' ? 'exceeded' : budgetStatus === 'approaching' ? 'warning' : '')} style={{ width: progressWidth + '%' }}></div>
                    </div>
                    <div className="progress-label">
                      <strong>{utilization.toFixed(1)}% utilized</strong>
                      <span>{money(Math.abs(remaining), profile.currency)} {remaining >= 0 ? 'remaining' : 'over limit'}</span>
                    </div>
                    <p className="field-hint">Alerts are issued once per month when spending reaches 75%, 90% and 100% of the budget.</p>
                    {budgetStatus !== 'normal' && (
                      <div className="budget-alert">
                        <Bell size={16} /> {budgetStatus === 'exceeded' ? 'You are ' + money(Math.abs(remaining), profile.currency) + ' over your budget.' : 'You have used at least 75% of this month’s budget.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="budget-empty">
                  <Wallet size={28} />
                  <strong>No budget configured for {monthLabel(month)}</strong>
                  <p>Your spending is still tracked. Set a monthly limit to see your remaining balance, usage and alerts.</p>
                  <button className="btn primary" onClick={openBudget}><Plus size={16} /> Set this month’s budget</button>
                </div>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Budget history</h3>
                    <p>Previously saved monthly limits</p>
                  </div>
                </div>
                {budgets.length ? (
                  <div className="history-list">
                    {[...budgets]
                      .sort((a, b) => b.month.localeCompare(a.month))
                      .map(b => (
                        <div className="history-row" key={b.id}>
                          <span>{monthLabel(b.month)}</span>
                          <strong>{money(b.amount, profile.currency)}</strong>
                          <span>
                            {money(
                              transactions
                                .filter(
                                  t =>
                                    t.kind === 'expense' &&
                                    t.date.startsWith(b.month)
                                )
                                .reduce((s, t) => s + t.amount, 0),
                              profile.currency
                            )}{' '}
                            spent
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Empty text="Your saved monthly budgets will show here." />
                )}
              </section>
            </>
          )}
          {view === 'Analytics' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">KNOW YOUR HABITS</span>
                  <h1>Analytics</h1>
                  <p>Understand your income and spending patterns.</p>
                </div>
              </div>
              <div className="stats-grid">
                <Stat
                  title="Expenses"
                  value={money(totalExpense, profile.currency)}
                  note={monthLabel(month)}
                  icon={ArrowUpRight}
                  tone="purple"
                />
                <Stat
                  title="Income"
                  value={money(totalIncome, profile.currency)}
                  note={monthLabel(month)}
                  icon={ArrowDownLeft}
                  tone="green"
                />
                <Stat
                  title="Net cash flow"
                  value={money(totalIncome - totalExpense, profile.currency)}
                  note="Income minus expenses"
                  icon={TrendingUp}
                  tone="blue"
                />
                <Stat
                  title="Avg. transaction"
                  value={money(
                    currentTx.length
                      ? currentTx.reduce((s, t) => s + t.amount, 0) /
                          currentTx.length
                      : 0,
                    profile.currency
                  )}
                  note="All transaction types"
                  icon={Activity}
                  tone="amber"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Six-month cash flow</h3>
                      <p>Income and expense comparison</p>
                    </div>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="legend-dot purple-dot"></i>Expenses
                    </span>
                    <span>
                      <i className="legend-dot green-dot"></i>Income
                    </span>
                  </div>
                  <div className="bar-chart tall">
                    {chartMonths.map(m => (
                      <div className="chart-col" key={m.key}>
                        <div className="bars">
                          <div
                            className="bar income-bar"
                            style={{
                              height:
                                (m.income /
                                  Math.max(
                                    1,
                                    ...chartMonths.flatMap(x => [
                                      x.income,
                                      x.expense,
                                    ])
                                  )) *
                                  190 +
                                'px',
                            }}
                          ></div>
                          <div
                            className="bar expense-bar"
                            style={{
                              height:
                                (m.expense /
                                  Math.max(
                                    1,
                                    ...chartMonths.flatMap(x => [
                                      x.income,
                                      x.expense,
                                    ])
                                  )) *
                                  190 +
                                'px',
                            }}
                          ></div>
                        </div>
                        <span>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Spending by category</h3>
                      <p>{monthLabel(month)}</p>
                    </div>
                  </div>
                  {categoryTotals.length ? (
                    categoryTotals.map(c => (
                      <div className="category-progress" key={c.id}>
                        <div>
                          <span>
                            {c.icon} {c.name}
                          </span>
                          <strong>{money(c.total, profile.currency)}</strong>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: (c.total / totalExpense) * 100 + '%',
                              background: c.color,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty text="Add expenses to see your category insights." />
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Monthly comparison</h3>
                    <p>Compare the last six months</p>
                  </div>
                </div>
                <div className="comparison-grid">
                  {chartMonths.map(m => (
                    <div className="comparison-item" key={m.key}>
                      <span>{m.label}</span>
                      <strong>{money(m.expense, profile.currency)}</strong>
                      <small>
                        {m.expense ? 'Expenses' : 'No spending recorded'}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === 'Savings goals' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SAVE FOR SOMETHING GREAT</span>
                  <h1>Savings goals</h1>
                  <p>Turn your plans into achievable milestones.</p>
                </div>
                <button className="btn primary" onClick={() => openGoal()}>
                  <Plus size={17} /> New goal
                </button>
              </div>
              {goals.length ? (
                <div className="goals-grid">
                  {goals.map(g => (
                    <div className="panel goal-card" key={g.id}>
                      <div className="goal-card-head">
                        <div className="goal-icon">
                          <Target />
                        </div>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setEditing(g);
                            setForm({ ...g });
                            setModal('goal');
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <h3>{g.name}</h3>
                      <p>
                        {g.deadline
                          ? 'Target date ' +
                            new Date(
                              g.deadline + 'T00:00:00'
                            ).toLocaleDateString()
                          : 'No target date'}
                      </p>
                      <div className="goal-amounts">
                        <strong>{money(g.saved, profile.currency)}</strong>
                        <span>of {money(g.target, profile.currency)}</span>
                      </div>
                      <div className="progress-track large">
                        <div
                          className="progress-fill green-fill"
                          style={{
                            width:
                              Math.min(100, (g.saved / g.target) * 100) + '%',
                          }}
                        ></div>
                      </div>
                      <div className="progress-label">
                        <strong>
                          {Math.min(100, (g.saved / g.target) * 100).toFixed(0)}
                          % complete
                        </strong>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setEditing(g);
                            setForm({ ...g, saved: String(g.saved) });
                            setModal('contribute');
                          }}
                        >
                          Add savings
                        </button>
                      </div>
                      <button
                        className="delete-link"
                        onClick={() => removeRecord('goals', g.id)}
                      >
                        <Trash2 size={14} /> Delete goal
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty text="No savings goals yet. Create one for a laptop, course, trip, or anything you are working towards." />
                  <button className="btn primary" onClick={() => openGoal()}>
                    <Plus size={16} /> Create your first goal
                  </button>
                </section>
              )}
            </>
          )}
          {view === 'Categories' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MAKE IT YOURS</span>
                  <h1>Categories</h1>
                  <p>Organize your spending and income your way.</p>
                </div>
                <button
                  className="btn primary"
                  onClick={() => {
                    openCategory();
                  }}
                >
                  <Plus size={17} /> Add category
                </button>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Expense categories</h3>
                      <p>Group your everyday spending</p>
                    </div>
                  </div>
                  <div className="category-cards">
                    {categories
                      .filter(c => c.type === 'expense')
                      .map(c => (
                        <div className="category-card" key={c.id}>
                          <span className="cat-emoji">{c.icon}</span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>
                              {
                                transactions.filter(
                                  t =>
                                    t.kind === 'expense' &&
                                    t.category === c.name
                                ).length
                              }{' '}
                              transactions
                            </small>
                          </div>
                          <div className="row-actions">
                            {!defaults.some(d => d.id === c.id) && <>
                              <button className="icon-btn" title="Edit category" onClick={() => openCategory(c)}><Edit2 size={14} /></button>
                              <button className="icon-btn danger-icon" title={categoryUsage(c) ? 'Category is in use' : 'Delete category'} disabled={categoryUsage(c) > 0} onClick={() => removeRecord('categories', c.id)}><Trash2 size={14} /></button>
                            </>}
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Income categories</h3>
                      <p>Track where money comes from</p>
                    </div>
                  </div>
                  <div className="category-cards">
                    {categories
                      .filter(c => c.type === 'income')
                      .map(c => (
                        <div className="category-card" key={c.id}>
                          <span className="cat-emoji">{c.icon}</span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>
                              {
                                transactions.filter(
                                  t =>
                                    t.kind === 'income' && t.category === c.name
                                ).length
                              }{' '}
                              transactions
                            </small>
                          </div>
                          <div className="row-actions">
                            {!defaults.some(d => d.id === c.id) && <>
                              <button className="icon-btn" title="Edit category" onClick={() => openCategory(c)}><Edit2 size={14} /></button>
                              <button className="icon-btn danger-icon" title={categoryUsage(c) ? 'Category is in use' : 'Delete category'} disabled={categoryUsage(c) > 0} onClick={() => removeRecord('categories', c.id)}><Trash2 size={14} /></button>
                            </>}
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === 'Reports' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR MONEY, SUMMARIZED</span>
                  <h1>Reports</h1>
                  <p>Export a clear record of your financial activity.</p>
                </div>
              </div>
              <section className="panel report-card">
                <div className="report-icon">
                  <FileBarChart />
                </div>
                <div>
                  <h3>{monthLabel(month)} report</h3>
                  <p>
                    Includes transactions, category details, total expenses and
                    income for the selected month.
                  </p>
                  <div className="report-stats">
                    <span>
                      <small>Expenses</small>
                      <strong>{money(totalExpense, profile.currency)}</strong>
                    </span>
                    <span>
                      <small>Income</small>
                      <strong>{money(totalIncome, profile.currency)}</strong>
                    </span>
                    <span>
                      <small>Transactions</small>
                      <strong>{currentTx.length}</strong>
                    </span>
                  </div>
                  <div className="report-actions">
                    <button className="btn primary" onClick={exportCSV}>
                      <Download size={16} /> Download CSV
                    </button>
                    <button className="btn secondary" onClick={exportPDF}>
                      <FileBarChart size={16} /> Print / Save PDF
                    </button>
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Month at a glance</h3>
                    <p>Selected reporting period</p>
                  </div>
                </div>
                <div className="stats-grid compact-stats">
                  <Stat
                    title="Net cash flow"
                    value={money(totalIncome - totalExpense, profile.currency)}
                    note="Income less expenses"
                    icon={TrendingUp}
                    tone="green"
                  />
                  <Stat
                    title="Budget remaining"
                    value={
                      budget ? money(remaining, profile.currency) : 'Not set'
                    }
                    note="After expenses"
                    icon={Wallet}
                    tone="blue"
                  />
                </div>
              </section>
            </>
          )}
          {(view === 'Settings' || view === 'Profile') && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR ACCOUNT</span>
                  <h1>Profile & settings</h1>
                  <p>Manage your student details and preferences.</p>
                </div>
              </div>
              <section className="panel settings-panel">
                <div className="settings-title">
                  <div className="avatar large-avatar">
                    {(profile.name || user.name || 'S')
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3>{profile.name || user.name || 'Student'}</h3>
                    <p>{user.email}</p>
                    <span className="soft-pill">
                      <ShieldCheck size={13} /> Secure account
                    </span>
                  </div>
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    saveRecord(
                      'profile',
                      { ...form, id: 'profile', email: user.email },
                      'profile'
                    );
                  }}
                  className="form-grid"
                >
                  <label>
                    Full name
                    <input
                      required
                      value={form.name ?? profile.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    Email address (managed by your sign-in provider)
                    <input disabled readOnly value={user.email || ''} />
                    <span className="field-hint">Changing your sign-in email is not supported inside ExpenseBuddy. Use your identity provider's account settings if it supports email changes.</span>
                  </label>
                  <label>
                    University / college
                    <input
                      value={form.institution ?? profile.institution}
                      onChange={e =>
                        setForm({ ...form, institution: e.target.value })
                      }
                      placeholder="Your institution"
                    />
                  </label>
                  <label>
                    Preferred currency
                    <select
                      value={form.currency ?? profile.currency}
                      onChange={e =>
                        setForm({ ...form, currency: e.target.value })
                      }
                    >
                      <option value="PKR">PKR — Pakistani Rupee</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="GBP">GBP — British Pound</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="AED">AED — UAE Dirham</option>
                    </select>
                  </label>
                  <div className="form-actions">
                    <button className="btn primary" disabled={busy}>
                      Save profile
                    </button>
                  </div>
                </form>
              </section>
              <section className="panel settings-row">
                <div>
                  <h3>Appearance</h3>
                  <p>Choose a comfortable display theme.</p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun size={16} /> : <Moon size={16} />}{' '}
                  {dark ? 'Switch to light' : 'Switch to dark'} mode
                </button>
              </section>
              <section className="panel settings-row">
                <div>
                  <h3>Account security</h3>
                  <p>
                    ExpenseBuddy uses AppDeploy-managed passwordless email sign-in and secure session restoration. Passwords are not collected or stored by this application. Password changes are not available in the current identity-provider integration; use provider account controls if your sign-in method supports them.
                  </p>
                </div>
                <button className="btn secondary" onClick={signOut}>
                  <LogOut size={16} /> Sign out
                </button>
              </section>
            </>
          )}
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal('');
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">EXPENSEBUDDY</span>
                <h2>
                  {modal === 'transaction'
                    ? editing
                      ? 'Edit expense / income'
                      : 'Add transaction'
                    : modal === 'budget'
                      ? 'Monthly budget'
                      : modal === 'goal'
                        ? editing
                          ? 'Edit savings goal'
                          : 'Create savings goal'
                        : modal === 'contribute'
                          ? 'Add to savings'
                          : modal === 'category'
                            ? editing ? 'Edit category' : 'New category'
                            : 'Transaction details'}
                </h2>
              </div>
              <button className="icon-btn" onClick={() => setModal('')}>
                <X />
              </button>
            </div>
            {modal === 'transaction' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const data = { kind: form.kind, amount: Number(form.amount), category: form.category, date: form.date, title: String(form.title || '').trim(), description: String(form.description || '').trim() };
                  if (!data.title || !data.description || !data.category || !data.date || !Number.isFinite(data.amount) || data.amount <= 0 || Number.isNaN(Date.parse(data.date + 'T00:00:00'))) return setErrorMsg('Complete all fields and enter an amount greater than zero with a valid date.');
                  saveRecord('transactions', data, editing?.id);
                }}
              >
                <div className="type-switch">
                  <button
                    type="button"
                    className={form.kind === 'expense' ? 'selected' : ''}
                    onClick={() =>
                      setForm({
                        ...form,
                        kind: 'expense',
                        category:
                          categories.find(c => c.type === 'expense')?.name ||
                          'Other',
                      })
                    }
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={
                      form.kind === 'income' ? 'selected income-selected' : ''
                    }
                    onClick={() =>
                      setForm({
                        ...form,
                        kind: 'income',
                        category:
                          categories.find(c => c.type === 'income')?.name ||
                          'Other',
                      })
                    }
                  >
                    Income
                  </button>
                </div>
                <label>
                  Expense title
                  <input required maxLength={80} placeholder="e.g. Lunch with classmates" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                  Amount
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={e =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    {categories
                      .filter(c => c.type === form.kind)
                      .map(c => (
                        <option key={c.id}>{c.name}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea required maxLength={120} rows={3} placeholder="Add a note about this expense" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </label>
                <ModalError error={errorMsg} />
                <button className="btn primary full" disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : editing
                      ? 'Save changes'
                      : 'Add transaction'}
                </button>
              </form>
            )}
            {modal === 'budget' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const existingForMonth = budgets.find(item => item.month === form.month && item.id !== editing?.id);
                  if (existingForMonth) return setErrorMsg('A budget already exists for ' + monthLabel(form.month) + '. Edit that month’s budget instead.');
                  const data = {
                    month: form.month,
                    amount: Number(form.amount),
                    alertedThresholds: form.month === editing?.month ? (editing?.alertedThresholds || []) : [],
                  };
                  if (!form.month || !Number.isFinite(data.amount) || data.amount <= 0) return setErrorMsg('Choose a month and enter a budget greater than zero.');
                  saveRecord('budgets', data, editing?.id);
                }}
              >
                <label>
                  Budget month
                  <input
                    required
                    type="month"
                    value={form.month}
                    onChange={e => setForm({ ...form, month: e.target.value })}
                  />
                </label>
                <label>
                  Monthly spending limit
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 25000"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
                <p className="field-hint">
                  Each calendar month has its own saved budget. Expenses are counted only when their transaction date falls within the selected month. Threshold alerts are sent once at 75%, 90% and 100%.
                </p>
                <ModalError error={errorMsg} />
                <button className="btn primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save budget'}
                </button>
              </form>
            )}
            {modal === 'goal' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const data = {
                    name: form.name.trim(),
                    target: Number(form.target),
                    saved: Number(form.saved || 0),
                    deadline: form.deadline || '',
                  };
                  if (!data.name || data.target <= 0 || data.saved < 0)
                    return setErrorMsg(
                      'Enter a name, a positive target and valid saved amount.'
                    );
                  saveRecord('goals', data, editing?.id);
                }}
              >
                <label>
                  Goal name
                  <input
                    required
                    maxLength={80}
                    placeholder="e.g. New laptop"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Target amount
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.target}
                    onChange={e => setForm({ ...form, target: e.target.value })}
                  />
                </label>
                <label>
                  Already saved
                  <input
                    type="number"
                    min="0"
                    value={form.saved}
                    onChange={e => setForm({ ...form, saved: e.target.value })}
                  />
                </label>
                <label>
                  Target date (optional)
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                </label>
                <ModalError error={errorMsg} />
                <button className="btn primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save goal'}
                </button>
              </form>
            )}
            {modal === 'contribute' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const amount = Number(form.contribution);
                  if (amount <= 0)
                    return setErrorMsg('Enter an amount greater than zero.');
                  saveRecord(
                    'goals',
                    { ...editing, saved: Number(editing.saved) + amount },
                    editing.id
                  );
                }}
              >
                <p className="muted">
                  Add money to <strong>{editing?.name}</strong>. Current saved
                  amount: {money(editing?.saved || 0, profile.currency)}.
                </p>
                <label>
                  Contribution amount
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.contribution || ''}
                    onChange={e =>
                      setForm({ ...form, contribution: e.target.value })
                    }
                  />
                </label>
                <ModalError error={errorMsg} />
                <button className="btn primary full" disabled={busy}>
                  Add contribution
                </button>
              </form>
            )}
            {modal === 'category' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!String(form.name || '').trim()) return setErrorMsg('Enter a category name.');
                  saveRecord('categories', { ...form, id: editing?.id || uid(), name: form.name.trim() }, editing?.id);
                }}
              >
                <label>
                  Category name
                  <input
                    required
                    maxLength={40}
                    value={form.name}
                    disabled={!!editing && categoryUsage(editing) > 0}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Books"
                  />
                </label>
                <label>
                  Type
                  <select
                    value={form.type}
                    disabled={!!editing && categoryUsage(editing) > 0}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label>
                  Icon (emoji)
                  <input
                    maxLength={4}
                    value={form.icon}
                    onChange={e => setForm({ ...form, icon: e.target.value })}
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                  />
                </label>
                <ModalError error={errorMsg} />
                <button className="btn primary full" disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Save category' : 'Create category'}
                </button>
              </form>
            )}
            {modal === 'details' && editing && (
              <div className="detail-list">
                <div><span>Title</span><strong>{editing.title || editing.description}</strong></div>
                <div><span>Amount</span><strong>{money(editing.amount, profile.currency)}</strong></div>
                <div><span>Category</span><strong>{editing.category}</strong></div>
                <div><span>Date</span><strong>{editing.date}</strong></div>
                <div><span>Type</span><strong>{editing.kind === 'expense' ? 'Expense' : 'Income'}</strong></div>
                <div><span>Description</span><p>{editing.description || 'No description added.'}</p></div>
                <div className="row-actions"><button className="btn secondary" onClick={() => openTx(editing)}><Edit2 size={15} /> Edit</button><button className="btn primary" onClick={() => setModal('')}>Done</button></div>
              </div>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  title,
  value,
  note,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: any;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={'stat-icon ' + tone}>
        <Icon size={19} />
      </div>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <BookOpen size={21} />
      </div>
      <p>{text}</p>
    </div>
  );
}
function ModalError({ error }: { error: string }) {
  return error ? (
    <div className="error">
      <AlertCircle size={15} />
      {error}
    </div>
  ) : null;
}
function TransactionTable({
  items,
  currency,
  onView,
  onEdit,
  onDelete,
}: {
  items: Tx[];
  currency: string;
  onView: (t: Tx) => void;
  onEdit: (t: Tx) => void;
  onDelete: (t: Tx) => void;
}) {
  return items.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Category</th>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id}>
              <td>
                <div className="transaction-name">
                  <div
                    className={
                      'tx-icon ' +
                      (t.kind === 'income' ? 'tx-income' : 'tx-expense')
                    }
                  >
                    {t.kind === 'income' ? (
                      <ArrowDownLeft size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </div>
                  <div>
                    <strong>{t.title || t.description}</strong>
                    <small>{t.kind === 'income' ? 'Income' : 'Expense'}</small>
                  </div>
                </div>
              </td>
              <td>
                <span className="category-tag">{t.category}</span>
              </td>
              <td className="date-cell">
                {new Date(t.date + 'T00:00:00').toLocaleDateString('en', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
              <td className="description-cell">{t.description || '—'}</td>
              <td className={t.kind === 'income' ? 'amount-in' : 'amount-out'}>
                {t.kind === 'income' ? '+' : '−'}
                {money(t.amount, currency)}
              </td>
              <td>
                <div className="row-actions">
                  <button className="icon-btn" title="View details" onClick={() => onView(t)}><Eye size={15} /></button>
                  <button className="icon-btn" title="Edit"
                    onClick={() => onEdit(t)}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    className="icon-btn danger-icon"
                    title="Delete"
                    onClick={() => onDelete(t)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No transactions found. Add your first transaction to start tracking your money." />
  );
}
export default App;
