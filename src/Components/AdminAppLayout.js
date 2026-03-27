import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "./supabase";
import { API_URL } from "./http-commons";
import { Bar } from "react-chartjs-2";
import { ThemeToggleButton } from "./Partials/ThemeToggleButton";
import { handleLogout } from "../App";
import { IconLogout, IconRefresh, IconDownload, IconSearch } from "./assets/Icon";
import { BookingsView } from "./admin/BookingsView";
import { ReportsView } from "./admin/ReportsView";
import { OmniChatView } from "./admin/OmniChatView";
import { DeviceManagement } from "./admin/DeviceManagement";

import axios from "axios";

export const AdminAppLayout = ({ session }) => {
    // Added 'staff'   to tabs
    const [activeTab, setActiveTab] = useState('live'); // 'live', 'stats', 'users', 'menu', 'staff', 'customers', 'devices'
    
    // Ref for scrolling to service form when editing
    const serviceFormRef = useRef(null);
    
    // Data States
    const [allQueues, setAllQueues] = useState([]);
    const [barbers, setBarbers] = useState([]);
    const [transferMode, setTransferMode] = useState(null);
    const [advancedStats, setAdvancedStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [services, setServices] = useState([]);
    const [isEditingService, setIsEditingService] = useState(null);
    const [vipPrice, setVipPrice] = useState(100);

    // Analytics Filter States
    const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

    // Customer Database States
    const [customers, setCustomers] = useState([]);
    const [customerPage, setCustomerPage] = useState(1);
    const [customerTotalPages, setCustomerTotalPages] = useState(1);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);


    // Users Pagination States
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    const fetchLiveShop = useCallback(async () => {
        try {
            const [qRes, bRes] = await Promise.all([
                supabase.from('queue_entries').select('*, services(name)').in('status', ['Waiting', 'Up Next', 'In Progress']),
                axios.get(`${API_URL}/admin/barbers`) // This returns ALL barbers (active and inactive)
            ]);
            setAllQueues(qRes.data || []);
            setBarbers(bRes.data || []);
        } catch (e) { console.error(e); }
    }, []);

    const fetchAdvancedStats = useCallback(async () => {
        setIsLoadingAnalytics(true);
        setAdvancedStats(null); // Reset stats to trigger loading state
        try { 
            console.log("Fetching analytics with period:", analyticsPeriod);
            const res = await axios.get(`${API_URL}/admin/analytics/filtered?period=${analyticsPeriod}`); 
            console.log("Analytics response:", res.data);
            setAdvancedStats(res.data); 
        } catch (e) {
            console.error("Failed to fetch analytics:", e);
            // Set empty stats to avoid "Crunching numbers" forever
            setAdvancedStats({ 
                totals: { revenue: 0, cuts: 0, period: analyticsPeriod },
                dailyTrend: [],
                barberStats: [],
                period_label: analyticsPeriod === 'daily' ? 'Today' : 
                              analyticsPeriod === 'weekly' ? 'Last 7 Days' : 
                              analyticsPeriod === 'monthly' ? 'Last 30 Days' : 
                              analyticsPeriod === 'yearly' ? 'Last 12 Months' : 'All Time',
                error: e.response?.data?.error || e.message
            });
        } finally {
            setIsLoadingAnalytics(false);
        }
    }, [analyticsPeriod]);

    const fetchCustomers = useCallback(async (page = 1, search = '') => {
        setIsLoadingCustomers(true);
        try {
            console.log("Fetching customers - page:", page, "search:", search);
            const res = await axios.get(`${API_URL}/admin/customers?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
            console.log("Customers response:", res.data);
            setCustomers(res.data.customers || []);
            setCustomerTotalPages(res.data.pagination?.totalPages || 1);
        } catch (e) {
            console.error("Failed to fetch customers:", e);
            // Set empty customers to avoid infinite loading
            setCustomers([]);
            setCustomerTotalPages(1);
            // Optionally alert the user
            // alert("Could not load customers. Please try again.");
        } finally {
            setIsLoadingCustomers(false);
        }
    }, []);

    const handleExportCSV = async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/analytics/export?period=${analyticsPeriod}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `analytics_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            console.error("Failed to export CSV:", e);
            alert("Failed to export CSV");
        }
    };

    const fetchUsers = useCallback(async (page = userPage) => {
        setIsLoadingUsers(true);
        try { 
            const res = await axios.get(`${API_URL}/admin/users?page=${page}&limit=20`); 
            setUsers(res.data.users || []);
            setUserTotalPages(res.data.pagination?.totalPages || 1);
            setUserPage(page); // Sync page state
        } catch (e) { 
            console.error("Failed to fetch users:", e);
            setUsers([]);
            setUserTotalPages(1);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [userPage]);

    const fetchServices = useCallback(async () => {
        try { 
            // Use the ADMIN endpoint to get active AND archived services
            const res = await axios.get(`${API_URL}/admin/services`); 
            setServices(res.data); 
        } catch (e) { console.error(e); }
    }, []);

    const handleRestoreService = async (id) => {
        try {
            await axios.put(`${API_URL}/admin/services/${id}/restore`, { userId: session.user.id });
            fetchServices();
            alert("Service restored.");
        } catch (e) { alert("Restore failed."); }
    };

    const fetchVipPrice = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/settings/vip-price`);
            setVipPrice(res.data.vip_price || 100);
        } catch (e) {
            console.error("Failed to fetch VIP price:", e);
        }
    }, []);

    const handleUpdateVipPrice = async (e) => {
        e.preventDefault();
        const newPrice = parseFloat(e.target.vipPriceInput.value);
        if (isNaN(newPrice) || newPrice < 0) {
            alert("Please enter a valid price.");
            return;
        }
        try {
            await axios.put(`${API_URL}/settings`, { key: 'vip_price', value: newPrice });
            setVipPrice(newPrice);
            alert(`VIP Price updated to ₱${newPrice}!`);
        } catch (err) {
            alert("Failed to update VIP price: " + (err.response?.data?.error || err.message));
        }
    };



    // --- EFFECTS ---
    useEffect(() => {
        // Refresh live data every 5 seconds
        if (activeTab === 'live' || activeTab === 'staff') { 
            fetchLiveShop(); 
            const interval = setInterval(fetchLiveShop, 5000); 
            return () => clearInterval(interval); 
        }
        if (activeTab === 'stats') fetchAdvancedStats();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'menu') {
            fetchServices();
            fetchVipPrice();
        }
        if (activeTab === 'customers') {
            fetchCustomers(customerPage, customerSearch);
        }
    }, [activeTab, fetchLiveShop, fetchAdvancedStats, fetchUsers, fetchServices, fetchVipPrice, fetchCustomers, customerPage, customerSearch, analyticsPeriod, userPage]);

    // Scroll to service form when editing starts
    useEffect(() => {
        if (isEditingService && serviceFormRef.current) {
            serviceFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isEditingService]);

    
    // --- ACTIONS ---
    
    // 1. Service Management
    const handleSaveService = async (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.serviceName.value;
        const duration = form.serviceDuration.value;
        const price = form.servicePrice.value;

        // Frontend Validation
        if (duration < 5) return alert("Duration must be at least 5 minutes.");
        if (price < 0) return alert("Price cannot be negative.");

        try {
            const payload = { userId: session.user.id, name, duration_minutes: duration, price_php: price };
            
            if (isEditingService) {
                await axios.put(`${API_URL}/admin/services/${isEditingService.id}`, payload);
                alert("Service updated!");
                setIsEditingService(null);
            } else {
                await axios.post(`${API_URL}/admin/services`, payload);
                alert("Service added!");
            }
            form.reset();
            fetchServices();
        } catch (err) {
            alert("Action failed: " + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteService = async (id) => {
        if (!window.confirm("Are you sure? This will hide the service from the menu (can be restored).")) return;
        try {
            await axios.delete(`${API_URL}/admin/services/${id}`, { data: { userId: session.user.id } });
            fetchServices(); // Refresh list
        } catch (err) { 
            alert("Archive failed: " + (err.response?.data?.error || err.message)); 
        }
    };

    const handleHardDeleteService = async (id) => {
        if (!window.confirm("⚠️ PERMANENT DELETE - Cannot be undone or restored!\\n\\nType 'PERMANENT' to confirm:")) return;
        const confirmText = prompt("Type 'PERMANENT' to permanently delete this service:");
        if (confirmText !== 'PERMANENT') return;
        try {
            await axios.delete(`${API_URL}/admin/services/${id}/hard-delete`, { data: { userId: session.user.id } });
            alert("Service permanently deleted.");
            fetchServices();
        } catch (err) { 
            alert("Hard delete failed: " + (err.response?.data?.error || err.message)); 
        }
    };

     // 2. User Management
    const handleDeleteUser = async (targetId) => {
        const confirmText = prompt("WARNING: This action cannot be undone.\nType 'DELETE' to permanently ban/delete this user account.");
        if (confirmText !== 'DELETE') return;
        try {
            await axios.delete(`${API_URL}/admin/users/${targetId}`, { data: { userId: session.user.id } });
            alert("User deleted.");
            fetchUsers(userPage);
        } catch (e) { alert("Delete failed: " + (e.response?.data?.error || e.message)); }
    };

    // 3. Staff Management (Toggle Active/Inactive)
    const handleToggleBarberStatus = async (barberId, currentStatus) => {
        const newStatus = !currentStatus;
        const action = newStatus ? "ACTIVATE" : "DEACTIVATE";
        if (!window.confirm(`Are you sure you want to ${action} this barber?`)) return;

        try {
            await axios.put(`${API_URL}/admin/barbers/${barberId}/status`, {
                userId: session.user.id,
                is_active: newStatus
            });
            fetchLiveShop(); // Refresh barber list
        } catch (err) {
            alert("Update failed: " + (err.response?.data?.error || err.message));
        }
    };

    // 4. Transfer Logic
    const handleTransfer = async (targetBarberId) => {
        if (!transferMode) return;
        if (window.confirm(`Transfer this customer to Barber #${targetBarberId}?`)) {
            try {
                await axios.put(`${API_URL}/admin/transfer`, {
                    userId: session.user.id,
                    queueId: transferMode.queueId,
                    targetBarberId: targetBarberId
                });
                setTransferMode(null);
                fetchLiveShop();
            } catch (e) { alert("Transfer failed."); }
        }
    };

    // --- SUB-COMPONENTS ---
    
    // [App.js] - Inside AdminAppLayout -> LiveShopView

    const LiveShopView = () => (
        <div className="live-shop-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px'}}>
            {barbers.filter(b => b.is_active).map(barber => {
                const barberQueue = allQueues.filter(q => q.barber_id === barber.id);
                const inChair = barberQueue.find(q => q.status === 'In Progress');
                const waiting = barberQueue.filter(q => q.status === 'Waiting');
                const upNext = barberQueue.find(q => q.status === 'Up Next');

                return (
                    <div key={barber.id} className="card" style={{border: transferMode ? '2px dashed var(--primary-orange)' : '1px solid var(--border-color)'}}>
                        <div className="card-header" style={{padding:'10px', justifyContent: 'space-between'}}>
                            <div>
                                <h3 style={{fontSize:'1rem', margin:0}}>{barber.full_name}</h3>
                                <small style={{color: barber.is_available ? 'var(--success-color)' : 'var(--text-secondary)'}}>
                                    ● {barber.is_available ? 'Online' : 'Offline'}
                                </small>
                            </div>
                            {transferMode && transferMode.currentBarberId !== barber.id && (
                                <button onClick={() => handleTransfer(barber.id)} className="btn btn-primary" style={{fontSize:'0.8rem', padding:'4px 8px'}}>Select</button>
                            )}
                            
                            {/* --- FEATURE 1: FORCE NEXT BUTTON --- */}
                            {!transferMode && !inChair && (waiting.length > 0 || upNext) && (
                                <button 
                                    onClick={async () => {
                                        if(!window.confirm(`Force next customer for ${barber.full_name}?`)) return;
                                        try {
                                            await axios.post(`${API_URL}/admin/force-next`, { userId: session.user.id, barberId: barber.id });
                                            alert("Customer moved to chair.");
                                            fetchLiveShop();
                                        } catch(e) { alert(e.response?.data?.error || "Failed."); }
                                    }} 
                                    className="btn btn-primary" 
                                    style={{fontSize:'0.75rem', padding:'4px 8px'}}
                                    title="Force Call Next"
                                >
                                    Force Next ⏩
                                </button>
                            )}
                        </div>
                        <div className="card-body" style={{padding:'10px'}}>
                            {inChair ? (
                                <div style={{background:'rgba(52,199,89,0.1)', padding:'5px', borderRadius:'4px', marginBottom:'5px', fontSize:'0.9rem', border: '1px solid var(--success-color)'}}>
                                    ✂️ <strong>{inChair.customer_name}</strong>
                                    <span style={{display:'block', fontSize:'0.7rem', color:'var(--text-secondary)'}}>Svc: {inChair.services?.name}</span>
                                </div>
                            ) : (
                                <div style={{fontStyle:'italic', fontSize:'0.9rem', color:'var(--text-secondary)', padding:'5px'}}>Chair Empty</div>
                            )}

                            {upNext && (
                                <div style={{background:'rgba(255,149,0,0.1)', padding:'5px', borderRadius:'4px', marginBottom:'5px', fontSize:'0.9rem', border: '1px solid var(--primary-orange)'}}>
                                    🔜 <strong>{upNext.customer_name}</strong> (Up Next)
                                </div>
                            )}

                            <h4 style={{fontSize:'0.8rem', color:'var(--text-secondary)', margin:'10px 0 5px 0'}}>Waiting ({waiting.length})</h4>
                            <ul className="queue-list" style={{maxHeight:'150px', overflowY:'auto'}}>
                                {waiting.map(q => (
                                    <li key={q.id} className={q.is_vip ? 'vip-entry' : ''} style={{display:'flex', justifyContent:'space-between', padding:'5px', fontSize:'0.85rem'}}>
                                        <span style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            {q.is_vip && <span style={{fontSize:'0.7rem'}}>👑</span>} 
                                            {q.customer_name}
                                        </span>
                                        <button onClick={() => setTransferMode({ queueId: q.id, currentBarberId: barber.id })} className="btn btn-secondary" style={{padding:'2px 5px', fontSize:'0.7rem'}}>➡ Move</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const StaffView = () => (
        <div className="card">
            <div className="card-header"><h2>Staff Management</h2></div>
            <div className="card-body" style={{overflowX: 'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', color:'var(--text-primary)', minWidth: '600px'}}>
                    <thead>
                        <tr style={{textAlign:'left', borderBottom:'1px solid var(--border-color)'}}>
                            <th style={{padding:'10px'}}>Barber Name</th>
                            <th style={{padding:'10px'}}>Status</th>
                            <th style={{padding:'10px'}}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {barbers.map(b => (
                            <tr key={b.id} style={{borderBottom:'1px solid var(--border-color)', opacity: b.is_active ? 1 : 0.5}}>
                                <td style={{padding:'10px'}}>{b.full_name}</td>
                                <td style={{padding:'10px'}}>
                                    {b.is_active ? <span style={{color:'var(--success-color)', fontWeight:'bold'}}>ACTIVE</span> : <span style={{color:'var(--error-color)', fontWeight:'bold'}}>BANNED/INACTIVE</span>}
                                </td>
                                <td style={{padding:'10px'}}>
                                    <button 
                                        onClick={() => handleToggleBarberStatus(b.id, b.is_active)} 
                                        className={b.is_active ? "btn btn-danger" : "btn btn-success"}
                                        style={{fontSize:'0.8rem', padding: '5px 10px'}}
                                    >
                                        {b.is_active ? 'Ban / Deactivate' : 'Unban & Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="message small">Deactivating a barber hides them from the customer "Join Queue" list immediately.</p>
            </div>
        </div>
    );

    const MenuView = () => (
        <div className="card">
            <div className="card-header">
                <h2>{isEditingService ? 'Edit Service' : 'Add New Service'}</h2>
            </div>
            <div className="card-body">
                <form 
                    ref={serviceFormRef}
                    onSubmit={handleSaveService} 
                    style={{display:'grid', gap:'10px', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', marginBottom:'20px', paddingBottom:'20px', borderBottom:'1px solid var(--border-color)'}}
                >
                    <div className="form-group"><label>Service Name</label><input name="serviceName" defaultValue={isEditingService?.name || ''} required placeholder="e.g. Haircut" /></div>
                    <div className="form-group"><label>Duration (mins)</label><input name="serviceDuration" type="number" defaultValue={isEditingService?.duration_minutes || 30} required min="5" /></div>
                    <div className="form-group"><label>Price (₱)</label><input name="servicePrice" type="number" defaultValue={isEditingService?.price_php || 150} required min="0" /></div>
                    <div style={{display:'flex', alignItems:'end', gap:'10px'}}>
                        <button type="submit" className="btn btn-primary btn-full-width">{isEditingService ? 'Update' : 'Add'}</button>
                        {isEditingService && <button type="button" onClick={() => setIsEditingService(null)} className="btn btn-secondary">Cancel</button>}
                    </div>
                </form>
                <h3 style={{marginTop:0}}>Current Services</h3>
                <ul className="queue-list">
                    {services.map(s => (
                        <li key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', opacity: s.is_active ? 1 : 0.5}}>
                            <div>
                                <strong>{s.name}</strong> 
                                <span style={{color:'var(--text-secondary)'}}> ({s.duration_minutes}m)</span>
                                {!s.is_active && <span style={{marginLeft:'8px', color:'var(--error-color)', fontWeight:'bold', fontSize:'0.7rem'}}>ARCHIVED</span>}
                                <div style={{fontWeight:'bold', color:'var(--primary-orange)'}}>₱{s.price_php}</div>
                            </div>
                            <div style={{display:'flex', gap:'10px'}}>
{s.is_active ? (
                                    <>
                                        <button onClick={() => setIsEditingService(s)} className="btn btn-secondary" style={{padding:'5px 10px'}}>Edit</button>
                                        <button onClick={() => handleDeleteService(s.id)} className="btn btn-danger" style={{padding:'5px 10px'}} title="Archive (soft delete)">Archive</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleRestoreService(s.id)} className="btn btn-success" style={{padding:'5px 10px'}}>Restore</button>
                                        <button onClick={() => handleHardDeleteService(s.id)} className="btn btn-danger" style={{padding:'5px 10px', fontSize:'0.8rem'}} title="⚠️ PERMANENT DELETE - Cannot be undone!">Hard Delete</button>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {/* --- VIP PRICE SETTING --- */}
                <div style={{marginTop:'30px', paddingTop:'20px', borderTop:'2px solid var(--primary-orange)'}}>
                    <h3 style={{color:'var(--primary-orange)', marginTop:0}}>👑 VIP Priority Setting</h3>
                    <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom:'15px'}}>
                        Set the price for VIP Priority service. This affects the "Up Next" button in customer dashboard.
                    </p>
                    <form onSubmit={handleUpdateVipPrice} style={{display:'flex', gap:'10px', alignItems:'end', flexWrap:'wrap'}}>
                        <div className="form-group" style={{marginBottom:0}}>
                            <label>VIP Price (₱)</label>
                            <input 
                                name="vipPriceInput" 
                                type="number" 
                                defaultValue={vipPrice} 
                                required 
                                min="0" 
                                style={{width:'120px'}}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary">Update VIP Price</button>
                    </form>
                    <p style={{marginTop:'10px', fontSize:'0.85rem', color:'var(--success-color)'}}>
                        Current VIP Price: <strong>₱{vipPrice}</strong>
                    </p>
                </div>
            </div>
        </div>
    );

    // --- SUPER DETAILED ANALYTICS VIEW (RESPONSIVE FIX) ---
    const StatsView = () => {
        if (isLoadingAnalytics) return <div className="loading-fullscreen"><span>Crunching numbers...</span></div>;
        
        // Handle empty or error state
        if (!advancedStats || (!advancedStats.totals && !advancedStats.error)) {
            return (
                <div className="loading-fullscreen">
                    <span>No analytics data available yet.</span>
                    <p style={{color: 'var(--text-secondary)', marginTop: '10px'}}>
                        Complete some services to see analytics!
                    </p>
                    <button onClick={() => fetchAdvancedStats()} className="btn btn-primary" style={{marginTop: '15px'}}>
                        <IconRefresh /> Retry
                    </button>
                </div>
            );
        }
        
        // Show error state if there was an error
        if (advancedStats.error) {
            return (
                <div className="loading-fullscreen">
                    <span style={{color: 'var(--error-color)'}}>Error loading analytics</span>
                    <p style={{color: 'var(--text-secondary)', marginTop: '10px'}}>
                        {advancedStats.error}
                    </p>
                    <button onClick={() => fetchAdvancedStats()} className="btn btn-primary" style={{marginTop: '15px'}}>
                        <IconRefresh /> Try Again
                    </button>
                </div>
            );
        }
        
        // --- SAFEGUARDS ---
        const totals = advancedStats.totals || { revenue: 0, cuts: 0, period: 'all' };
        const dailyTrend = advancedStats.dailyTrend || [];
        const barberStats = advancedStats.barberStats || [];
        const periodLabel = advancedStats.period_label || 'All Time';

        // 1. Prepare Chart Data
        const trendData = {
            labels: dailyTrend.map(d => d.day),
            datasets: [{
                label: 'Shop Revenue (₱)',
                data: dailyTrend.map(d => d.daily_total),
                borderColor: '#ff9500',
                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };
        const barberComparisonData = {
            labels: barberStats.map(b => b.full_name),
            datasets: [{
                label: 'Total Revenue (₱)',
                data: barberStats.map(b => b.revenue),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                ],
                borderWidth: 1
            }]
        };
        const topBarber = barberStats.length > 0 ? barberStats[0] : { full_name: 'No Data', revenue: 0 };

        return (
            <div className="stats-container">
                {/* --- FILTER CONTROLS --- */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <label style={{fontWeight: 'bold'}}>Period:</label>
                        <select 
                            value={analyticsPeriod} 
                            onChange={(e) => setAnalyticsPeriod(e.target.value)}
                            style={{padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)'}}
                        >
                            <option value="all">All Time</option>
                            <option value="daily">Today</option>
                            <option value="weekly">Last 7 Days</option>
                            <option value="monthly">Last 30 Days</option>
                            <option value="yearly">Last 12 Months</option>
                        </select>
                        <button onClick={() => fetchAdvancedStats()} className="btn btn-secondary" style={{padding: '8px'}}>
                            <IconRefresh />
                        </button>
                    </div>
                    <button onClick={handleExportCSV} className="btn btn-primary">
                        <IconDownload /> Export CSV
                    </button>
                </div>

                {/* --- ROW 1: KPI CARDS --- */}
                <div className="analytics-grid" style={{marginBottom: '20px'}}>
                    <div className="analytics-item">
                        <span className="analytics-label">Total Shop Revenue ({periodLabel})</span>
                        <span className="analytics-value" style={{color: 'var(--success-color)'}}>
                            ₱{parseInt(totals.revenue || 0).toLocaleString()}
                        </span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Total Haircuts</span>
                        <span className="analytics-value">{totals.cuts || 0}</span>
                    </div>
                    <div className="analytics-item">
                        <span className="analytics-label">Top Performer 🏆</span>
                        <span className="analytics-value" style={{fontSize: '1.4rem'}}>
                            {topBarber.full_name}
                        </span>
                        <small style={{color: 'var(--text-secondary)'}}>
                            Earned ₱{(topBarber.revenue || 0).toLocaleString()}
                        </small>
                    </div>
                </div>

                {/* --- ROW 2: CHARTS (Responsive Grid) --- */}
                <div style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', // Decreased min-width for mobile
                    gap: '20px', 
                    marginBottom: '20px'
                }}>
                    <div className="card" style={{padding: '20px'}}>
                        <h3 style={{marginTop: 0, fontSize: '1rem'}}>📈 7-Day Revenue Trend</h3>
                        <div style={{height: '250px'}}>
                            <Bar data={trendData} options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } } 
                            }} />
                        </div>
                    </div>
                    <div className="card" style={{padding: '20px'}}>
                        <h3 style={{marginTop: 0, fontSize: '1rem'}}>💈 Barber Comparison (Revenue)</h3>
                        <div style={{height: '250px'}}>
                            <Bar data={barberComparisonData} options={{ 
                                indexAxis: 'y', 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }} />
                        </div>
                    </div>
                </div>

                {/* --- ROW 3: DETAILED LEADERBOARD TABLE (Scrollable) --- */}
                <div className="card">
                    <div className="card-header">
                        <h2>Detailed Performance Matrix</h2>
                    </div>
                    {/* FIX: Added overflowX auto here to allow table scrolling on mobile */}
                    <div className="card-body" style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '600px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid var(--border-color)', textAlign: 'left'}}>
                                    <th style={{padding: '12px'}}>Barber Name</th>
                                    <th style={{padding: '12px'}}>Status</th>
                                    <th style={{padding: '12px', textAlign: 'center'}}>Cuts</th>
                                    <th style={{padding: '12px', textAlign: 'center'}}>Rating</th>
                                    <th style={{padding: '12px', textAlign: 'right'}}>Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {barberStats.length > 0 ? (
                                    barberStats.map((b, i) => (
                                        <tr key={i} style={{borderBottom: '1px solid var(--border-color)'}}>
                                            <td style={{padding: '12px', fontWeight: '600'}}>
                                                {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
                                                {b.full_name}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                {b.is_active 
                                                    ? <span style={{color: 'var(--success-color)', background: 'rgba(52,199,89,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>Active</span> 
                                                    : <span style={{color: 'var(--text-secondary)', background: 'rgba(100,100,100,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>Inactive</span>
                                                }
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'center', fontSize: '1.1rem'}}>
                                                {b.cut_count}
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'center'}}>
                                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                                    <span style={{color: '#FFD700'}}>★</span>
                                                    <strong>{b.avg_rating > 0 ? b.avg_rating : '-'}</strong>
                                                    <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                                                        ({b.review_count})
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-orange)', fontSize: '1.1rem'}}>
                                                ₱{(b.total_revenue || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>No performance data available yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const UsersView = () => (
        <div className="card">
            <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2>Users</h2>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <button 
                        onClick={() => setUserPage(p => Math.max(1, p - 1))} 
                        disabled={userPage === 1}
                        className="btn btn-secondary"
                    >
                        Previous
                    </button>
                    <span>Page {userPage} of {userTotalPages}</span>
                    <button 
                        onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))} 
                        disabled={userPage >= userTotalPages}
                        className="btn btn-secondary"
                    >
                        Next
                    </button>
                </div>
            </div>
            <div className="card-body">
                {isLoadingUsers ? (
                    <div className="loading-fullscreen"><span>Loading users...</span></div>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width:'100%', borderCollapse:'collapse', color:'var(--text-primary)', minWidth: '600px'}}>
                            <thead>
                                <tr style={{textAlign:'left', borderBottom:'1px solid var(--border-color)'}}>
                                    <th style={{padding:'10px'}}>Name</th><th style={{padding:'10px'}}>Role</th><th style={{padding:'10px'}}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users.map(u => (
                                        <tr key={u.id} style={{borderBottom:'1px solid var(--border-color)'}}>
                                            <td style={{padding:'10px'}}>{u.full_name}</td><td style={{padding:'10px'}}>{u.role}</td>
                                            <td style={{padding:'10px'}}>{u.role !== 'admin' && <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger" style={{fontSize:'0.8rem'}}>Delete</button>}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" style={{padding:'20px', textAlign:'center', color:'var(--text-secondary)'}}>
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const CustomersView = () => (
        <div className="card">
            <div className="card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2>Customer Database</h2>

            </div>
            <div className="card-body">
                {/* Search and Pagination Controls */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input 
                            type="text" 
                            placeholder="Search by name or email..." 
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchCustomers(1, customerSearch)}
                            style={{padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)', minWidth: '250px'}}
                        />
                        <button onClick={() => {setCustomerPage(1); fetchCustomers(1, customerSearch);}} className="btn btn-secondary">
                            <IconSearch />
                        </button>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <button 
                            onClick={() => setCustomerPage(p => Math.max(1, p - 1))} 
                            disabled={customerPage === 1}
                            className="btn btn-secondary"
                        >
                            Previous
                        </button>
                        <span>Page {customerPage} of {customerTotalPages}</span>
                        <button 
                            onClick={() => setCustomerPage(p => Math.min(customerTotalPages, p + 1))} 
                            disabled={customerPage >= customerTotalPages}
                            className="btn btn-secondary"
                        >
                            Next
                        </button>
                    </div>
                </div>

                {isLoadingCustomers ? (
                    <div className="loading-fullscreen"><span>Loading customers...</span></div>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width:'100%', borderCollapse:'collapse', color:'var(--text-primary)', minWidth: '600px'}}>
                            <thead>
                                <tr style={{textAlign:'left', borderBottom:'1px solid var(--border-color)'}}>
                                    <th style={{padding:'10px'}}>Name</th>
                                    <th style={{padding:'10px'}}>Email</th>
                                    <th style={{padding:'10px'}}>Joined</th>

                                </tr>
                            </thead>
                            <tbody>
                                {customers.length > 0 ? (
                                    customers.map(c => (
                                        <tr key={c.id} style={{borderBottom:'1px solid var(--border-color)'}}>
                                            <td style={{padding:'10px', fontWeight: '600'}}>{c.full_name}</td>
                                            <td style={{padding:'10px'}}>{c.email || 'N/A'}</td>
                                            <td style={{padding:'10px'}}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</td>

                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" style={{padding:'20px', textAlign:'center'}}>

                                            {customerSearch ? (
                                                <div>
                                                    <p>No customers found matching "{customerSearch}"</p>
                                                    <button 
                                                        onClick={() => {setCustomerSearch(''); fetchCustomers(1, '');}} 
                                                        className="btn btn-secondary"
                                                        style={{marginTop: '10px'}}
                                                    >
                                                        Clear Search
                                                    </button>
                                                </div>
                                            ) : (
                                                <p>No customers in the database yet.</p>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
    
    return (
        <div className="app-layout admin-layout">
            <header className="app-header" style={{ borderBottom: '2px solid #7c4dff' }}>
                <h1>Admin Command Center</h1>
                <div className="header-actions">
                    <ThemeToggleButton />
                    <button onClick={() => handleLogout(session.user.id)} className="btn btn-icon"><IconLogout /></button>
                </div>
            </header>
            

            {transferMode && (
                <div style={{background:'var(--primary-orange)', color:'black', padding:'10px', textAlign:'center', fontWeight:'bold'}}>
                    TRANSFER MODE ACTIVE: Select a barber below to move the customer. 
                    <button onClick={() => setTransferMode(null)} style={{marginLeft:'10px', background:'white', border:'none', padding:'2px 8px', borderRadius:'4px'}}>Cancel</button>
                </div>
            )}

            <div className="customer-view-tabs card-header" style={{ justifyContent: 'center', background: 'var(--surface-color)', marginTop: '10px', flexWrap: 'wrap' }}>
                <button className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>⚡ Live Shop</button>
                <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>📊 Analytics</button>
                <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>💈 Staff</button>
                <button className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>✂️ Service</button>
                <button className={activeTab === 'omni' ? 'active' : ''} onClick={() => setActiveTab('omni')}>💬 Omni-Chat</button>
                <button className={activeTab === 'bookings' ? 'active' : ''} onClick={() => setActiveTab('bookings')}>📅 Bookings</button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>👥 Users</button>
                <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => setActiveTab('customers')}>👤 Customers</button>
                <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>🚨 Reports</button>
                <button className={activeTab === 'devices' ? 'active' : ''} onClick={() => setActiveTab('devices')}>📱 Devices</button>
            </div>

            <main className="main-content">
                <div className="container" style={{maxWidth:'1200px', width: '100%', padding: '20px 15px 40px', boxSizing: 'border-box', margin: '0 auto'}}>
                    {activeTab === 'live' && <LiveShopView />}
                    {activeTab === 'stats' && <StatsView />}
                    {activeTab === 'staff' && <StaffView />}
                    {activeTab === 'menu' && <MenuView />}
                    {activeTab === 'omni' && <OmniChatView session={session} />}
                    {activeTab === 'bookings' && <BookingsView />}
                    {activeTab === 'users' && <UsersView />}
                    {activeTab === 'customers' && <CustomersView />}
                    
                    {/* --- ADD THIS LINE --- */}
                    {activeTab === 'reports' && <ReportsView />}
                    {activeTab === 'devices' && <DeviceManagement session={session} />}
                </div>
            </main>
        </div>
    );
}
