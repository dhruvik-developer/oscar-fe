/**
 * ProgressBar — CRM-styled linear progress bar.
 */
export function ProgressBar({ value = 0, max = 100, color = 'blue', height = 6, showLabel = false }) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colorMap = {
    blue: '#1f6bff',
    green: '#1bb878',
    red: '#f43f5e',
    yellow: '#ef9b06',
    purple: '#9b51e0',
  };

  const barColor = colorMap[color] || color;

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          borderRadius: height / 2,
          background: '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: barColor,
            borderRadius: height / 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
