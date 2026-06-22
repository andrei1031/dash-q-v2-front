export const DistanceBadge = ({ meters, label }) => {
    if (meters === null || meters === undefined) return null;
    
    let colorClass = 'dist-green';
    let text = `${meters}m`;

    if (meters > 20) {
        colorClass = 'dist-red';
        text = `${(meters / 1000).toFixed(1)}km`;
    } else if (meters > 10) {
        colorClass = 'dist-orange';
    }
    return (
        <span className="badge-distance">
            {label || `${Math.round(meters)}m`}
        </span>
    );
}
