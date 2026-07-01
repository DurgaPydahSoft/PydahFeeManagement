import { useEffect, useState } from 'react';

/**
 * SessionDisplacedModal
 *
 * Shown when the user has been logged out because their account was logged in
 * from another device. Displayed on the /login page immediately after redirect.
 *
 * Auto-dismisses after 8 seconds.
 */
const SessionDisplacedModal = ({ onClose }) => {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        const start = Date.now();
        const duration = 8000;

        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
                onClose();
            }
        }, 50);

        return () => clearInterval(interval);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(4px)',
                animation: 'sdm-fadein 0.3s ease',
            }}
        >
            <style>{`
                @keyframes sdm-fadein {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes sdm-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.07); }
                }
            `}</style>
            <div
                style={{
                    background: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                    padding: '40px 36px 32px',
                    maxWidth: '420px',
                    width: '90%',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Top accent bar */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #ef4444, #f97316)',
                }} />

                {/* Icon */}
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                    border: '2px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    animation: 'sdm-pulse 2s ease-in-out infinite',
                }}>
                    <svg width="34" height="34" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#111827',
                    margin: '0 0 10px',
                    letterSpacing: '-0.3px',
                }}>
                    Session Ended
                </h2>

                {/* Message */}
                <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    lineHeight: '1.6',
                    margin: '0 0 6px',
                }}>
                    Your account has been logged in on{' '}
                    <span style={{ color: '#111827', fontWeight: '600' }}>another device</span>.
                </p>
                <p style={{
                    fontSize: '13px',
                    color: '#9ca3af',
                    margin: '0 0 28px',
                }}>
                    For security, this session has been ended automatically.
                </p>

                {/* Dismiss button */}
                <button
                    onClick={onClose}
                    style={{
                        background: 'linear-gradient(135deg, #ef4444, #f97316)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 28px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        letterSpacing: '0.2px',
                    }}
                >
                    Go to Login
                </button>

                {/* Progress bar */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: '3px',
                    background: '#f3f4f6',
                }}>
                    <div style={{
                        height: '100%',
                        width: progress + '%',
                        background: 'linear-gradient(90deg, #ef4444, #f97316)',
                        transition: 'width 50ms linear',
                    }} />
                </div>
            </div>
        </div>
    );
};

export default SessionDisplacedModal;
