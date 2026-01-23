
export const DistanceBadge = ({ meters }) => {
    if (meters === null || meters === undefined) return null;
    
    let colorClass = 'dist-green';
    let text = `${meters}m`;

    if (meters > 1000) {
        colorClass = 'dist-red';
        text = `${(meters / 1000).toFixed(1)}km`;
    } else if (meters > 200) {
        colorClass = 'dist-orange';
    }
    return (
        <span className={`distance-badge ${colorClass}`}>
            📍 {text} away
        </span>
    );
}
