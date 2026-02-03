import React, { useState, useEffect } from 'react';
import { 
  getTransactions, 
  saveTransaction, 
  deleteTransaction,
  getCategories, 
  saveCategory, 
  deleteCategory, 
  checkAndGenerateMonthlyExpenses,
  getInitialBalance,
  saveInitialBalance
} from './services/storageService';
import { Transaction, TransactionType, CategoryItem } from './types';
import TransactionForm from './components/TransactionForm';
import CategoryManager from './components/CategoryManager';
import IncomeManager from './components/IncomeManager';
import SavingsManager from './components/SavingsManager';
import FinancialAdvisor from './components/FinancialAdvisor';
import StatsCard from './components/StatsCard';
import InstallmentTracker from './components/InstallmentTracker';
import FixedExpensesView from './components/FixedExpensesView';
import MonthSelector from './components/MonthSelector';
import ConfirmModal from './components/ConfirmModal';
import { 
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CalendarClock, 
  Plus, 
  History,
  LayoutDashboard,
  Repeat,
  X,
  Edit2,
  Trash2,
  CloudCheck,
  PiggyBank
} from 'lucide-react';

type View = 'DASHBOARD' | 'FIXED_EXPENSES';

const App: React.FC = () => {
  // Global Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  
  // View State
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the month being viewed
  const [loading, setLoading] = useState(true);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [formDefaultType, setFormDefaultType] = useState<TransactionType>(TransactionType.EXPENSE); // State to control default form type
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showIncomeManager, setShowIncomeManager] = useState(false);
  const [showSavingsManager, setShowSavingsManager] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Delete Confirmation State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Temp State for Balance Input (Controlled Component)
  const [tempBalanceInput, setTempBalanceInput] = useState('');

  // --- Initialization (Async) ---
  const loadData = async () => {
      setLoading(true);
      try {
          const cats = await getCategories();
          setCategories(cats);
          
          const bal = await getInitialBalance();
          setInitialBalance(bal);
          
          await checkAndGenerateMonthlyExpenses();
          
          const txs = await getTransactions();
          setTransactions(txs);
      } catch (error) {
          console.error("Error loading data:", error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Derived State (Calculated before handlers so they can be used) ---

  // 1. Filter Transactions for Selected Month
  const currentMonthTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === selectedDate.getMonth() && 
             tDate.getFullYear() === selectedDate.getFullYear();
  });

  // 2. Global Totals (Calculated from ALL transactions)
  const totalGlobalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalGlobalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalGlobalSavings = transactions
    .filter(t => t.type === TransactionType.SAVINGS)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // The displayed Global Balance (Liquid Cash)
  // Logic: Initial + Income - Expense - Savings (Savings moves money OUT of the wallet into savings account)
  const globalBalance = initialBalance + totalGlobalIncome - totalGlobalExpense - totalGlobalSavings;

  // 3. Monthly Stats (Only for the selected view)
  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlySavings = currentMonthTransactions
    .filter(t => t.type === TransactionType.SAVINGS)
    .reduce((sum, t) => sum + t.amount, 0);

  // 4. Monthly Installment Commitment
  const monthlyInstallmentsTotal = transactions
    .filter(t => t.installmentPlan)
    .reduce((sum, t) => {
        const plan = t.installmentPlan!;
        const start = new Date(plan.startDate);
        const end = new Date(start);
        end.setMonth(start.getMonth() + plan.totalInstallments);
        
        const sMonth = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
        const eMonth = new Date(end.getFullYear(), end.getMonth(), 1).getTime();
        const curMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getTime();

        if (curMonth >= sMonth && curMonth < eMonth) {
            return sum + plan.monthlyAmount;
        }
        return sum;
    }, 0);

  // 5. Chart Data
  const categoryDataMap = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const barChartData = Object.keys(categoryDataMap).map(key => ({
    name: key,
    Gasto: categoryDataMap[key],
  })).sort((a, b) => b.Gasto - a.Gasto).slice(0, 7); 

  // --- Handlers (Now Async) ---
  
  const handleAddTransaction = async (t: Transaction) => {
    await saveTransaction(t);
    const txs = await getTransactions();
    setTransactions(txs);
    if (editingTransaction) setEditingTransaction(null);
  };

  const handleRequestDelete = (id: string) => {
      setTransactionToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (transactionToDelete) {
        setTransactions(prev => prev.filter(t => t.id !== transactionToDelete)); 
        await deleteTransaction(transactionToDelete);
        const txs = await getTransactions();
        setTransactions(txs);
        setTransactionToDelete(null);
        setShowForm(false); 
        setShowIncomeManager(false);
        setShowSavingsManager(false);
    }
  };

  const openEditForm = (t: Transaction) => {
      setEditingTransaction(t);
      setShowForm(true);
      if (showIncomeManager) setShowIncomeManager(false);
      if (showSavingsManager) setShowSavingsManager(false);
  };

  const handleUpdateTransaction = async (t: Transaction) => {
    await saveTransaction(t);
    const txs = await getTransactions();
    setTransactions(txs);
  };

  const handleAddCategory = async (c: CategoryItem) => {
    await saveCategory(c);
    const cats = await getCategories();
    setCategories(cats);
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    const cats = await getCategories();
    setCategories(cats);
  };

  const handlePayInstallment = async (parentTransaction: Transaction, installmentNumber: number) => {
      if (!parentTransaction.installmentPlan) return;

      const now = new Date();
      let paymentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), now.getDate(), 12, 0, 0);
      
      if (selectedDate.getMonth() !== now.getMonth() || selectedDate.getFullYear() !== now.getFullYear()) {
           paymentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12, 0, 0);
      } else {
           paymentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      }

      const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
      };

      const newT: Transaction = {
          id: generateId(),
          amount: parentTransaction.installmentPlan.monthlyAmount,
          description: `${parentTransaction.description} (Cuota ${installmentNumber}/${parentTransaction.installmentPlan.totalInstallments})`,
          category: parentTransaction.category,
          date: paymentDate.toISOString(),
          type: TransactionType.EXPENSE,
          status: 'PAID',
          parentTransactionId: parentTransaction.id
      };

      await saveTransaction(newT);
      const txs = await getTransactions();
      setTransactions(txs);
  };

  // Balance Modal Handlers
  const handleOpenBalanceModal = () => {
    setTempBalanceInput(globalBalance.toString());
    setShowBalanceModal(true);
  };

  const handleSaveInitialBalance = async (e: React.FormEvent) => {
      e.preventDefault();
      const targetBalance = parseFloat(tempBalanceInput);
      
      if(!isNaN(targetBalance)) {
          // New Logic: Balance = Initial + Income - Expense - Savings
          // So Initial = Target - Income + Expense + Savings
          const netFlow = totalGlobalIncome - totalGlobalExpense - totalGlobalSavings;
          const newInitial = targetBalance - netFlow;

          await saveInitialBalance(newInitial);
          setInitialBalance(newInitial);
          setShowBalanceModal(false);
      }
  };

  const handlePrevMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleResetMonth = () => {
    setSelectedDate(new Date());
  };

  // Helper to render amount colors
  const getAmountColor = (t: Transaction) => {
      if (t.type === TransactionType.INCOME) return 'text-emerald-600';
      if (t.type === TransactionType.SAVINGS) return 'text-cyan-600';
      return 'text-slate-700';
  };
  
  const getAmountPrefix = (t: Transaction) => {
      if (t.type === TransactionType.INCOME) return '+';
      if (t.type === TransactionType.SAVINGS) return '='; // Or an arrow? '=' implies neutral to balance? No, it's money put aside.
      return '-';
  };

  if (loading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="animate-spin text-indigo-600 mb-4">
                <CloudCheck size={40} />
            </div>
            <div className="text-slate-600 font-medium animate-pulse">Sincronizando con la nube...</div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 md:pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
                <Wallet className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-violet-700 hidden sm:block">
                FinanzaFlow
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="hidden md:flex gap-4">
                    <button 
                        onClick={() => setCurrentView('DASHBOARD')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'DASHBOARD' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Dashboard
                    </button>
                    <button 
                        onClick={() => setCurrentView('FIXED_EXPENSES')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'FIXED_EXPENSES' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Gastos Fijos
                    </button>
                </div>
                
                <div 
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200"
                  title="Tus datos se guardan en Google Cloud"
                >
                    <CloudCheck size={16} />
                    <span className="hidden sm:inline">En línea</span>
                </div>
            </div>

            <button 
              onClick={() => { 
                setEditingTransaction(null); 
                setFormDefaultType(TransactionType.EXPENSE);
                setShowForm(true); 
              }}
              className="md:hidden bg-indigo-600 text-white p-2 rounded-full shadow-lg ml-2"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <MonthSelector 
            selectedDate={selectedDate}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
            onReset={handleResetMonth}
        />

        {/* KPI Grid - Responsive Adjustments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="lg:col-span-1">
            <StatsCard 
                title="Disponible" 
                amount={globalBalance} 
                icon={Wallet} 
                colorClass="text-indigo-600" 
                bgClass="bg-indigo-50"
                isEditable
                isMain={true} 
                onClick={handleOpenBalanceModal}
            />
          </div>
          <StatsCard 
            title="Ingresos" 
            amount={monthlyIncome} 
            icon={TrendingUp} 
            colorClass="text-emerald-600" 
            bgClass="bg-emerald-50"
            isEditable
            onClick={() => setShowIncomeManager(true)}
          />
          <StatsCard 
            title="Ahorros (Mes)" 
            amount={monthlySavings} 
            icon={PiggyBank} 
            colorClass="text-cyan-600" 
            bgClass="bg-cyan-50"
            isEditable
            onClick={() => setShowSavingsManager(true)}
          />
          <StatsCard 
            title="Gastos (Mes)" 
            amount={monthlyExpense} 
            icon={TrendingDown} 
            colorClass="text-rose-600" 
            bgClass="bg-rose-50"
          />
          <StatsCard 
            title="Cuotas (Mes)" 
            amount={monthlyInstallmentsTotal} 
            icon={CalendarClock} 
            colorClass="text-amber-600" 
            bgClass="bg-amber-50"
            trend="A debitar"
          />
        </div>

        {currentView === 'DASHBOARD' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
            <div className="lg:col-span-2 space-y-8">
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <LayoutDashboard className="text-indigo-500" size={20} />
                        <h3 className="text-lg font-bold text-slate-800">Resumen del Mes</h3>
                    </div>

                    <div className="h-64 w-full">
                        <h4 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">Gastos por Categoría</h4>
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <YAxis tick={{fontSize: 12}} stroke="#94a3b8" tickFormatter={(v) => `$${v}`} />
                                <RechartsTooltip 
                                    formatter={(value: number) => `$${value.toLocaleString()}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="Gasto" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                Sin gastos registrados este mes
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <History className="text-slate-400" size={20} />
                        <h3 className="text-lg font-bold text-slate-800">Movimientos de {selectedDate.toLocaleDateString('es-AR', {month: 'long'})}</h3>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="pb-3 pl-2 font-medium">Concepto</th>
                        <th className="pb-3 font-medium">Categoría</th>
                        <th className="pb-3 font-medium">Fecha</th>
                        <th className="pb-3 font-medium text-right pr-2">Monto</th>
                        <th className="pb-3 font-medium text-right w-20">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {currentMonthTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                        <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-3 pl-2">
                            <div className="font-medium text-slate-700">{t.description}</div>
                            {t.installmentPlan && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                {t.installmentPlan.totalInstallments} cuotas
                                </span>
                            )}
                            </td>
                            <td className="py-3 text-sm text-slate-500">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${t.type === TransactionType.SAVINGS ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100'}`}>
                                {t.category}
                            </span>
                            </td>
                            <td className="py-3 text-sm text-slate-400">
                            {new Date(t.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className={`py-3 text-right pr-2 font-bold ${getAmountColor(t)}`}>
                                {getAmountPrefix(t)}${t.amount.toLocaleString()}
                            </td>
                            <td className="py-3 text-right pr-2">
                                <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); openEditForm(t); }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRequestDelete(t.id); }}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                    {currentMonthTransactions.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            No hay movimientos en este mes.
                        </div>
                    )}
                </div>
                </div>
            </div>

            <div className="space-y-8">
                <button
                onClick={() => { 
                    setEditingTransaction(null); 
                    setFormDefaultType(TransactionType.EXPENSE);
                    setShowForm(true); 
                }}
                className="hidden md:flex w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-indigo-500/25 transition-all items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                <Plus size={24} />
                <span>Registrar Movimiento</span>
                </button>

                <InstallmentTracker 
                    transactions={transactions} 
                    selectedDate={selectedDate}
                    onEdit={openEditForm}
                    onDelete={handleRequestDelete}
                    onPayInstallment={handlePayInstallment}
                />

                <FinancialAdvisor transactions={currentMonthTransactions} />
            </div>

            </div>
        )}

        {currentView === 'FIXED_EXPENSES' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <FixedExpensesView 
                        categories={categories} 
                        transactions={transactions} 
                        onUpdateTransaction={handleUpdateTransaction}
                    />
                </div>
                <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                        <h4 className="font-bold text-amber-800 mb-2">Consejo</h4>
                        <p className="text-sm text-amber-700">
                            Mantén tus gastos fijos por debajo del 50% de tus ingresos para una salud financiera óptima.
                        </p>
                    </div>
                </div>
            </div>
        )}

      </main>

      {/* Global Modals */}

      {/* 1. Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!transactionToDelete}
        title="Eliminar Transacción"
        message="¿Estás seguro de que deseas eliminar este movimiento? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        onCancel={() => setTransactionToDelete(null)}
      />

      {/* 2. Income Manager Modal */}
      {showIncomeManager && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
             <IncomeManager 
                transactions={transactions}
                onAddIncome={() => {
                    setEditingTransaction(null);
                    setFormDefaultType(TransactionType.INCOME);
                    setShowForm(true);
                    setShowIncomeManager(false);
                }}
                onEdit={(t) => openEditForm(t)}
                onDelete={handleRequestDelete}
                onClose={() => setShowIncomeManager(false)}
             />
          </div>
      )}

      {/* 3. Savings Manager Modal (NEW) */}
      {showSavingsManager && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
             <SavingsManager 
                transactions={transactions}
                onAddSaving={() => {
                    setEditingTransaction(null);
                    setFormDefaultType(TransactionType.SAVINGS);
                    setShowForm(true);
                    setShowSavingsManager(false);
                }}
                onEdit={(t) => openEditForm(t)}
                onDelete={handleRequestDelete}
                onClose={() => setShowSavingsManager(false)}
             />
          </div>
      )}

      {/* 4. Transaction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {showCategoryManager ? (
               <CategoryManager 
                  categories={categories}
                  onAdd={handleAddCategory}
                  onDelete={handleDeleteCategory}
                  onClose={() => setShowCategoryManager(false)}
               />
            ) : (
               <TransactionForm 
                  categories={categories}
                  onAdd={handleAddTransaction} 
                  onClose={() => setShowForm(false)} 
                  onOpenCategoryManager={() => setShowCategoryManager(true)}
                  initialData={editingTransaction}
                  onDelete={handleRequestDelete}
                  defaultType={formDefaultType}
               />
            )}
          </div>
        </div>
      )}

      {/* 5. Balance Edit Modal */}
      {showBalanceModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800">Ajustar Balance Actual</h3>
                      </div>
                      <button onClick={() => setShowBalanceModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={24}/>
                      </button>
                  </div>
                  
                  <p className="text-slate-500 mb-4 leading-relaxed">
                      Modifica el monto total para que coincida con tu dinero real. 
                      La app ajustará automáticamente el saldo inicial para cuadrar las cuentas.
                  </p>
                  
                  <form onSubmit={handleSaveInitialBalance}>
                      <div className="relative mb-8 group">
                          <span className="absolute left-4 top-4 text-slate-400 font-bold text-2xl group-focus-within:text-indigo-500 transition-colors">$</span>
                          <input 
                            name="initialBal"
                            type="number" 
                            step="0.01"
                            value={tempBalanceInput}
                            onChange={(e) => setTempBalanceInput(e.target.value)}
                            className="w-full pl-10 pr-6 py-4 bg-white border-2 border-indigo-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-3xl font-bold text-slate-800 shadow-sm"
                            autoFocus
                            placeholder="0"
                          />
                      </div>
                      <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl transition-all transform hover:-translate-y-0.5">
                          Actualizar Balance
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* Mobile Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden z-40">
        <div className="flex justify-around items-center h-16">
            <button 
                onClick={() => setCurrentView('DASHBOARD')}
                className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
                <LayoutDashboard size={20} />
                <span className="text-[10px] font-bold mt-1">Inicio</span>
            </button>
            <div className="w-12"></div>
            <button 
                onClick={() => setCurrentView('FIXED_EXPENSES')}
                className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'FIXED_EXPENSES' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
                <Repeat size={20} />
                <span className="text-[10px] font-bold mt-1">Fijos</span>
            </button>
        </div>
      </div>
      
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-50">
        <button 
            onClick={() => { 
                setEditingTransaction(null); 
                setFormDefaultType(TransactionType.EXPENSE);
                setShowForm(true); 
            }}
            className="w-14 h-14 bg-indigo-600 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
            <Plus size={28} />
        </button>
      </div>

    </div>
  );
};

export default App;