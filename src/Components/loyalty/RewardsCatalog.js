import { useState } from "react";
import axios from "axios";
import { API_URL } from "../http-commons";

export const RewardsCatalog = ({ rewards, myPoints, userId, onRedeemSuccess }) => {
    const [redeeming, setRedeeming] = useState(null);
    const [message, setMessage] = useState('');

    const handleRedeem = async (rewardId) => {
        if (!window.confirm('Are you sure you want to redeem this reward?')) return;

        setRedeeming(rewardId);
        setMessage('');

        try {
            const response = await axios.post(`${API_URL}/loyalty/redeem`, {
                userId,
                rewardId
            });

            setMessage(response.data.message);
            if (onRedeemSuccess) {
                onRedeemSuccess();
            }
        } catch (error) {
            setMessage(error.response?.data?.error || 'Failed to redeem reward');
        } finally {
            setRedeeming(null);
        }
    };

    return (
        <div>
            {message && (
                <div style={{
                    padding: '10px',
                    marginBottom: '15px',
                    borderRadius: '8px',
                    background: message.includes('Success') || message.includes('successfully') 
                        ? 'rgba(52, 199, 89, 0.1)' 
                        : 'rgba(255, 59, 48, 0.1)',
                    color: message.includes('Success') || message.includes('successfully')
                        ? 'var(--success-color)'
                        : 'var(--error-color)',
                    textAlign: 'center'
                }}>
                    {message}
                </div>
            )}

            <div style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Your Points: </span>
                <strong style={{ color: 'var(--primary-orange)', fontSize: '1.2rem' }}>{myPoints}</strong>
            </div>

            {rewards.length > 0 ? (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {rewards.map((reward) => {
                        const canRedeem = myPoints >= reward.points_required;
                        const isRedeeming = redeeming === reward.id;

                        return (
                            <div key={reward.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '15px',
                                background: 'var(--surface-color)',
                                borderRadius: '10px',
                                border: `1px solid ${canRedeem ? 'var(--primary-orange)' : 'var(--border-color)'}`,
                                opacity: reward.is_limited && reward.redeemed_count >= reward.limited_quantity ? 0.6 : 1
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 5px 0' }}>{reward.name}</h4>
                                    <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {reward.description}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {reward.discount_fixed > 0 && (
                                            <span style={{
                                                background: 'rgba(52, 199, 89, 0.1)',
                                                color: 'var(--success-color)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold'
                                            }}>
                                                ₱{reward.discount_fixed} OFF
                                            </span>
                                        )}
                                        {reward.discount_percentage > 0 && (
                                            <span style={{
                                                background: 'rgba(52, 199, 89, 0.1)',
                                                color: 'var(--success-color)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {reward.discount_percentage}% OFF
                                            </span>
                                        )}
                                        {reward.is_limited && (
                                            <span style={{
                                                background: 'rgba(255, 149, 0, 0.1)',
                                                color: 'var(--primary-orange)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem'
                                            }}>
                                                {reward.limited_quantity - reward.redeemed_count} left
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                                    <div style={{
                                        fontSize: '1.3rem',
                                        fontWeight: 'bold',
                                        color: canRedeem ? 'var(--primary-orange)' : 'var(--text-secondary)'
                                    }}>
                                        {reward.points_required}
                                    </div>
                                    <small style={{ color: 'var(--text-secondary)' }}>points</small>
                                    <div style={{ marginTop: '8px' }}>
                                        <button
                                            onClick={() => handleRedeem(reward.id)}
                                            disabled={!canRedeem || isRedeeming || (reward.is_limited && reward.redeemed_count >= reward.limited_quantity)}
                                            className={canRedeem ? "btn btn-primary" : "btn btn-secondary"}
                                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                        >
                                            {isRedeeming ? 'Redeeming...' : 'Redeem'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <p>No rewards available at the moment.</p>
                    <p>Check back soon!</p>
                </div>
            )}
        </div>
    );
};

