export default function ScrollableScreen({ children, bottomPadding, showIndicator = true, style, className, useMinHeight = false }) {
  const pad = bottomPadding || 'calc(170px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className={className || ''}
      style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        overflowX: 'hidden',
        ...style,
        paddingBottom: pad,
      }}
    >
      {children}
    </div>
  );
}
