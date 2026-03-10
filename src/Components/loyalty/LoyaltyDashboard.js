import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";
import { IconStar, IconGift, IconTrophy, IconReferral } from "../assets/Icon";
import { RewardsCatalog } from "./RewardsCatalog";

export const LoyaltyDashboard = ({ session, userId }) => {
    const [loyaltyData, setLoyaltyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('points'); // 'points', 'rewards', 'history', 'referral'
    const [referralCode, setReferralCode] = useState('');
    const [referralInput, setReferralInput] = useState('');
    const [referralMessage, setReferralMessage] = useState('');

    useEffect(() => {
        if (userId) {
            fetchLoyaltyData();
        }
    }, [userId]);

    const fetchLoyaltyData = async () => {
        try {
            const [loyaltyRes, rewardsRes, referralRes] = await Promise.all([
                axios.get(`${API_URL}/loyalty/${userId}`),
                axios.get(`${API_URL}/loyalty/rewards?userId=${userId}`),
                axios.get(`${API_URL}/loyalty/referral/${userId}`)
            ]);

            setLoyaltyData({
                ...loyaltyRes.data,
                rewards: rewardsRes.data.availableRewards || [],
                myRedemptions: rewardsRes.data.myRedemptions || [],
                referral: referralRes.data
            });
            setReferralCode(referralRes.data.referralCode || '');
        } catch (error) {
            console.error('Failed to load loyalty data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUseReferralCode = async () => {
        if (!referralInput.trim()) return;
        try {
            const response = await axios.post(`${API_URL}/loyalty/referral/use`, {
                userId,
                referralCode: referralInput
            });
            setReferralMessage(response.data.message);
            fetchLoyaltyData(); // Refresh data
            setReferralInput('');
        } catch (error) {
            setReferralMessage(error.response?.data?.error || 'Invalid referral code');
        }
    };

    const copyReferralCode = () => {
        navigator.clipboard.writeText(referralCode);
        setReferralMessage('Code copied to clipboard!');
    };

    if (loading) {
        return (
            <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
                    <p>Loading loyalty data...</p>
                </div>
            </div>
        );
    }

    const { loyalty, transactions, tierBenefits } = loyaltyData || {};
    const tierColors = {
        bronze: '#cd7f32',
        silver: '#c0c0c0',
        gold: '#ffd700',
        platinum: '#e5e4e2'
    };

    return (
        <div className="card">
            {/* Tier Banner */}
            <div style={{
                background: `linear-gradient(135deg, ${tierColors[loyalty?.current_tier] || '#cd7f32'}20, ${tierColors[loyalty?.current_tier] || '#cd7f32'}40)`,
                padding: '20px',
                borderBottom: `3px solid ${tierColors[loyalty?.current_tier] || '#cd7f32'}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <small style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Current Tier
                        </small>
                        <h2 style={{ 
                            margin: '5px 0', 
                            color: tierColors[loyalty?.current_tier] || '#cd7f32',
                            textTransform: 'capitalize'
                        }}>
                            {loyalty?.current_tier || 'bronze'} Member
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {tierBenefits?.multiplier}x points multiplier
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <small style={{ color: 'var(--text-secondary)' }}>Total Points</small>
                        <h1 style={{ 
                            margin: '5px 0', 
                            fontSize: '2.5rem',
                            color: 'var(--primary-orange)'
                        }}>
                            {loyalty?.total_points || 0}
                        </h1>
                    </div>
                </div>

                {/* Progress to next tier */}
                {tierBenefits?.nextTier && (
                    <div style={{ marginTop: '15px' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '0.8rem', 
                            marginBottom: '5px' 
                        }}>
                            <span>{loyalty?.current_tier}</span>
                            <span>{tierBenefits?.nextTier}</span>
                        </div>
                        <div style={{
                            height: '8px',
                            background: 'var(--bg-dark)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${Math.min(100, ((loyalty?.total_points || 0) % (tierBenefits?.pointsToNextTier || 500)) / (tierBenefits?.pointsToNextTier || 500) * 100)}%`,
                                background: `linear-gradient(90deg, ${tierColors[loyalty?.current_tier]}, ${tierColors[tierBenefits?.nextTier]})`,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <p style={{ 
                            margin: '5px 0 0', 
                            fontSize: '0.75rem', 
                            color: 'var(--text-secondary)',
                            textAlign: 'center'
                        }}>
                            {tierBenefits?.pointsToNextTier - ((loyalty?.total_points || 0) % (tierBenefits?.pointsToNextTier || 500))} points to {tierBenefits?.nextTier}
                        </p>
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '10px', 
                padding: '15px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', color: 'var(--primary-orange)' }}>💰</div>
                    <div style={{ fontWeight: 'bold' }}>₱{(loyalty?.total_spent || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total Spent</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem' }}>✂️</div>
                    <div style={{ fontWeight: 'bold' }}>{loyalty?.total_visits || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Visits</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem' }}>⭐</div>
                    <div style={{ fontWeight: 'bold' }}>{loyalty?.lifetime_points || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Lifetime Points</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="customer-view-tabs" style={{ 
                display: 'flex', 
                padding: '10px',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <button 
                    className={activeTab === 'points' ? 'active' : ''} 
                    onClick={() => setActiveTab('points')}
                    style={{ flex: 1 }}
                >
                    <IconStar /> Points
                </button>
                <button 
                    className={activeTab === 'rewards' ? 'active' : ''} 
                    onClick={() => setActiveTab('rewards')}
                    style={{ flex: 1 }}
                >
                    <IconGift /> Rewards
                </button>
                <button 
                    className={activeTab === 'history' ? 'active' : ''} 
                    onClick={() => setActiveTab('history')}
                    style={{ flex: 1 }}
                >
                    📜 History
                </button>
                <button 
                    className={activeTab === 'referral' ? 'active' : ''} 
                    onClick={() => setActiveTab('referral')}
                    style={{ flex: 1 }}
                >
                    <IconReferral /> Refer
                </button>
            </div>

            {/* Tab Content */}
            <div className="card-body">
                {activeTab === 'points' && (
                    <div>
                        <h3>How to Earn Points</h3>
                        <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                            <li>Earn 1 point for every ₱10 spent</li>
                            <li>Silver tier: 1.25x points</li>
                            <li>Gold tier: 1.5x points</li>
                            <li>Platinum tier: 2x points</li>
                            <li>Refer a friend: 100 bonus points</li>
                        </ul>
                    </div>
                )}

                {activeTab === 'rewards' && (
                    <RewardsCatalog 
                        rewards={loyaltyData?.rewards || []}
                        myPoints={loyalty?.total_points || 0}
                        userId={userId}
                        onRedeemSuccess={fetchLoyaltyData}
                    />
                )}

                {activeTab === 'history' && (
                    <div>
                        <h3>Points History</h3>
                        {transactions?.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {transactions.map((trans, index) => (
                                    <li key={index} style={{
                                        padding: '12px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>
                                                {trans.transaction_type === 'earned' && '✅ '}
                                                {trans.transaction_type === 'redeemed' && '🎁 '}
                                                {trans.transaction_type === 'bonus' && '🎉 '}
                                                {trans.description}
                                            </div>
                                            <small style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(trans.created_at).toLocaleDateString()}
                                            </small>
                                        </div>
                                        <div style={{ 
                                            fontWeight: 'bold',
                                            color: trans.points > 0 ? 'var(--success-color)' : 'var(--error-color)'
                                        }}>
                                            {trans.points > 0 ? '+' : ''}{trans.points}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No transactions yet. Complete a service to earn points!
                            </p>
                        )}
                    </div>
                )}

                {activeTab === 'referral' && (
                    <div>
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <IconTrophy style={{ fontSize: '3rem', marginBottom: '10px' }} />
                            <h3>Refer Friends & Earn</h3>
                            <p>Share your code and earn 100 points when they complete their first visit!</p>
                            
                            {referralCode && (
                                <div style={{ 
                                    margin: '20px 0',
                                    padding: '15px',
                                    background: 'var(--bg-dark)',
                                    borderRadius: '8px'
                                }}>
                                    <small>Your Referral Code</small>
                                    <div style={{ 
                                        fontSize: '2rem', 
                                        fontWeight: 'bold', 
                                        letterSpacing: '3px',
                                        color: 'var(--primary-orange)'
                                    }}>
                                        {referralCode}
                                    </div>
                                    <button 
                                        onClick={copyReferralCode}
                                        className="btn btn-secondary"
                                        style={{ marginTop: '10px' }}
                                    >
                                        Copy Code
                                    </button>
                                </div>
                            )}

                            <div style={{ marginTop: '30px' }}>
                                <h4>Have a referral code?</h4>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <input 
                                        type="text"
                                        value={referralInput}
                                        onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                                        placeholder="Enter code"
                                        style={{ flex: 1 }}
                                    />
                                    <button onClick={handleUseReferralCode} className="btn btn-primary">
                                        Apply
                                    </button>
                                </div>
                                {referralMessage && (
                                    <p style={{ 
                                        marginTop: '10px', 
                                        color: referralMessage.includes('copied') || referralMessage.includes('Success') 
                                            ? 'var(--success-color)' 
                                            : 'var(--error-color)'
                                    }}>
                                        {referralMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

