// The Fit / Fight tab pair — the top of the Simplify revamp's navigation.
//
// This replaces the "CHOOSE YOUR PATH" screen. Picking a mode used to cost a
// screen of its own that you had to back out of; now it is a tab you switch
// in place, so Fit and Fight are one tap apart from anywhere in training.
//
// The joint between the two tabs is a skewed wing on the ACTIVE tab, leaning
// away from it (fit leans right, fight leans left), which is why this needs
// real CSS rather than inline styles: it is a ::before/::after and there is no
// inline equivalent. The wing overhangs its tab by 17px, so nothing on this
// row may clip its overflow.
const VIOLET_FILL = 'linear-gradient(180deg,#3A2470 0%,#1A1034 55%,#120B24 100%)';
const BLUE_FILL = 'linear-gradient(180deg,#16307A 0%,#0C1838 55%,#081026 100%)';

export const modeTabsCSS = `
.mt { position: relative; display: flex; height: 56px; padding: 0; flex-shrink: 0;
  background: linear-gradient(180deg,#0F0D1C,#08070F);
  border: 1px solid rgba(255,255,255,.07); border-radius: 16px 16px 6px 6px; }
.mt-tab { position: relative; flex: 1; height: 100%; border: 0; background: transparent;
  color: #6F7699; display: flex; align-items: center; justify-content: center;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: color .2s ease; }
.mt-tab > span { position: relative; z-index: 2; font-family: 'Chakra Petch', system-ui, sans-serif;
  font-weight: 700; font-size: 16px; letter-spacing: .06em; }
.mt-tab .mt-bar { display: none; position: absolute; z-index: 2; left: 16%; right: 16%;
  bottom: 7px; height: 3px; border-radius: 2px; }
.mt-tab:hover:not(.on), .mt-tab:focus-visible:not(.on) { color: #C9C4DE; }
.mt-tab:focus-visible { outline: 2px solid #F2BE45; outline-offset: -3px; }
.mt-tab.on { color: #FFFFFF; z-index: 1; border-radius: 16px 16px 0 0; }
.mt-tab.on .mt-bar { display: block; }

.mt-tab.fit.on { background: ${VIOLET_FILL};
  box-shadow: inset 0 1.5px 0 #B794FF, inset 1.5px 0 0 rgba(183,148,255,.75), 0 -3px 18px rgba(157,108,255,.35); }
.mt-tab.fit.on::after { content: ''; position: absolute; top: 0; bottom: 0; right: -17px; width: 34px;
  background: ${VIOLET_FILL}; border-top: 1.5px solid #B794FF; border-right: 1.5px solid #B794FF;
  border-top-right-radius: 12px; transform: skewX(30deg); box-sizing: border-box; }
.mt-tab.fit.on .mt-bar { background: linear-gradient(90deg,#6B3DF0,#C4A8FF 50%,#6B3DF0); box-shadow: 0 0 10px #9D6CFF; }

.mt-tab.fight.on { background: ${BLUE_FILL};
  box-shadow: inset 0 1.5px 0 #7EA6FF, inset -1.5px 0 0 rgba(126,166,255,.75), 0 -3px 18px rgba(61,123,255,.35); }
.mt-tab.fight.on::before { content: ''; position: absolute; top: 0; bottom: 0; left: -17px; width: 34px;
  background: ${BLUE_FILL}; border-top: 1.5px solid #7EA6FF; border-left: 1.5px solid #7EA6FF;
  border-top-left-radius: 12px; transform: skewX(-30deg); box-sizing: border-box; }
.mt-tab.fight.on .mt-bar { background: linear-gradient(90deg,#2458E0,#8FB4FF 50%,#2458E0); box-shadow: 0 0 10px #3D7BFF; }
`;

export default function ModeTabs({ active, onFit, onFight, style }) {
  // Each tab is its own guide anchor: the intro tour used to spotlight the two
  // mode cards on "Choose Your Path", and those steps need somewhere to land.
  const tab = (id, label, onClick) => (
    <button
      type="button" className={`mt-tab ${id}${active === id ? ' on' : ''}`}
      data-guide={`mode-${id}`}
      onClick={active === id ? undefined : onClick}
      aria-current={active === id ? 'page' : undefined}
      style={{ font: 'inherit' }}
    >
      <span>{label}</span>
      <i className="mt-bar" aria-hidden="true"/>
    </button>
  );

  return (
    <>
      <style>{modeTabsCSS}</style>
      <nav className="mt" aria-label="Training mode" style={style}>
        {tab('fit', 'FIT MODE', onFit)}
        {tab('fight', 'FIGHT MODE', onFight)}
      </nav>
    </>
  );
}
