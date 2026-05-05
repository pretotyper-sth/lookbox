// clothes.jsx — Realistic-leaning 2D clothing illustrations.
// Style goal: looks like a flat-lay garment photo (extracted on white) —
// soft gradient body, fabric folds, seams, hardware, drop shadow on the
// floor. Not pictorial photography, but readable as "this is MY shearling
// jacket" rather than a generic icon.

const CLOTHES_PALETTE = {
  cream: '#EAE2D2', creamHi: '#F5EFE2', creamLo: '#C9BD9F',
  ivory: '#F1ECE0', beige: '#D7C8A8',
  tan: '#B89868', tanHi: '#CFB387', tanLo: '#8E6F40',
  camel: '#8E6F40', brown: '#5C3A1E', brownHi: '#7A5430', espresso: '#3A2618',
  black: '#1A1A1A', blackHi: '#3A3A3D', charcoal: '#2E2E30',
  gray: '#A8A8A8', grayHi: '#C9C9C9', grayLo: '#7A7A7A',
  lightGray: '#D9D7D2', lightGrayHi: '#E8E6E1',
  denim: '#2F4868', denimHi: '#5A7896', denimLo: '#1F3148',
  midDenim: '#4A6884', lightDenim: '#A8BBCE', lightDenimHi: '#C2D2E0',
  navy: '#1F2A40', white: '#F8F6F1', gold: '#C8A560',
};

// Shared filters: soft body shadow + ground shadow
function ClothDefs({ id }) {
  return (
    <defs>
      <filter id={`sh-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
        <feOffset dx="0" dy="4"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id={`grnd-${id}`}>
        <feGaussianBlur stdDeviation="6"/>
      </filter>
    </defs>
  );
}

// Ground shadow ellipse — placed under garments for realism
function GroundShadow({ id, cx, cy, rx = 60, ry = 8, opacity = 0.18 }) {
  return (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={opacity} filter={`url(#grnd-${id})`}/>
  );
}

// ─── TOPS ───────────────────────────────────────────────────
function ShearlingJacket({ size = 200 }) {
  const id = 'sj';
  const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={P.creamLo}/>
          <stop offset="0.15" stopColor={P.cream}/>
          <stop offset="0.5" stopColor={P.creamHi}/>
          <stop offset="0.85" stopColor={P.cream}/>
          <stop offset="1" stopColor={P.creamLo}/>
        </linearGradient>
        <radialGradient id={`${id}-fuzz`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.creamHi} stopOpacity="0.6"/>
          <stop offset="1" stopColor={P.creamHi} stopOpacity="0"/>
        </radialGradient>
        <pattern id={`${id}-tex`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill={P.creamHi} opacity="0.5"/>
          <circle cx="0.5" cy="2.5" r="0.4" fill={P.creamLo} opacity="0.3"/>
        </pattern>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="68" ry="6" opacity="0.22"/>
      <g filter={`url(#sh-${id})`}>
        {/* sleeves — set behind body */}
        <path d="M48 70 Q40 75 36 92 L30 168 Q30 178 40 180 L62 180 Q66 170 64 158 L60 92 Q58 80 64 74 Z" fill={`url(#${id}-body)`}/>
        <path d="M152 70 Q160 75 164 92 L170 168 Q170 178 160 180 L138 180 Q134 170 136 158 L140 92 Q142 80 136 74 Z" fill={`url(#${id}-body)`}/>
        {/* sleeve shading edge */}
        <path d="M48 70 Q40 75 36 92 L30 168" fill="none" stroke={P.creamLo} strokeWidth="1.5" opacity="0.5"/>
        <path d="M152 70 Q160 75 164 92 L170 168" fill="none" stroke={P.creamLo} strokeWidth="1.5" opacity="0.5"/>
        {/* body — boxy crop jacket */}
        <path d="M62 64 L52 76 L48 184 Q48 188 52 188 L148 188 Q152 188 152 184 L148 76 L138 64 L120 56 Q110 64 100 64 Q90 64 80 56 Z"
          fill={`url(#${id}-body)`}/>
        {/* fuzzy texture overlay */}
        <path d="M62 64 L52 76 L48 184 Q48 188 52 188 L148 188 Q152 188 152 184 L148 76 L138 64 L120 56 Q110 64 100 64 Q90 64 80 56 Z"
          fill={`url(#${id}-tex)`} opacity="0.4"/>
        {/* spread collar */}
        <path d="M80 56 L74 70 L92 76 L100 64 Z" fill={P.creamHi}/>
        <path d="M120 56 L126 70 L108 76 L100 64 Z" fill={P.creamHi}/>
        <path d="M80 56 L74 70 L92 76 L100 64 Z" fill="none" stroke={P.creamLo} strokeWidth="0.6"/>
        <path d="M120 56 L126 70 L108 76 L100 64 Z" fill="none" stroke={P.creamLo} strokeWidth="0.6"/>
        {/* center placket — topstitched */}
        <line x1="100" y1="64" x2="100" y2="188" stroke={P.creamLo} strokeWidth="0.6" opacity="0.6"/>
        <line x1="102" y1="68" x2="102" y2="186" stroke={P.creamLo} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        {/* buttons */}
        {[88, 110, 132, 154, 176].map(y => (
          <g key={y}>
            <circle cx="100" cy={y} r="2.4" fill={P.tan}/>
            <circle cx="100" cy={y} r="1.8" fill="none" stroke={P.tanLo} strokeWidth="0.4"/>
          </g>
        ))}
        {/* flap pockets */}
        <path d="M58 130 L84 128 L86 152 L60 154 Z" fill="none" stroke={P.creamLo} strokeWidth="0.7"/>
        <path d="M58 130 L84 128 L84 138 L58 140 Z" fill={P.creamLo} opacity="0.18"/>
        <circle cx="71" cy="135" r="1" fill={P.tan}/>
        <path d="M114 128 L142 130 L140 154 L114 152 Z" fill="none" stroke={P.creamLo} strokeWidth="0.7"/>
        <path d="M114 128 L142 130 L142 140 L114 138 Z" fill={P.creamLo} opacity="0.18"/>
        <circle cx="129" cy="135" r="1" fill={P.tan}/>
        {/* body shading on sides */}
        <path d="M52 76 L48 184 Q48 188 52 188 L62 188 L60 78 Z" fill="#000" opacity="0.06"/>
        <path d="M148 76 L152 184 Q152 188 148 188 L138 188 L140 78 Z" fill="#000" opacity="0.06"/>
        {/* shoulder fold */}
        <path d="M62 64 L80 56 L80 60 L66 70 Z" fill="#000" opacity="0.04"/>
        <path d="M138 64 L120 56 L120 60 L134 70 Z" fill="#000" opacity="0.04"/>
        {/* hem stitching */}
        <line x1="48" y1="184" x2="152" y2="184" stroke={P.creamLo} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.6"/>
      </g>
    </svg>
  );
}

function CroppedTop({ size = 200 }) {
  const id = 'ct'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#0F0F11"/>
          <stop offset="0.5" stopColor="#2E2E30"/>
          <stop offset="1" stopColor="#0F0F11"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="142" rx="50" ry="4"/>
      <g filter={`url(#sh-${id})`}>
        {/* long sleeves */}
        <path d="M52 70 Q44 80 42 100 L38 130 Q38 138 46 140 L60 138 L62 90 Q58 78 60 72 Z" fill={`url(#${id}-g)`}/>
        <path d="M148 70 Q156 80 158 100 L162 130 Q162 138 154 140 L140 138 L138 90 Q142 78 140 72 Z" fill={`url(#${id}-g)`}/>
        {/* body — square neck cropped */}
        <path d="M60 70 L58 132 L142 132 L140 70 L120 64 Q110 70 100 70 Q90 70 80 64 Z" fill={`url(#${id}-g)`}/>
        {/* square neckline */}
        <path d="M82 64 Q92 72 100 72 Q108 72 118 64 L118 70 Q108 76 100 76 Q92 76 82 70 Z" fill="#0A0A0C"/>
        {/* knit ribbing horizontal lines */}
        <g opacity="0.25" stroke="#3F3F42" strokeWidth="0.35">
          {Array.from({length: 18}, (_,i) => <line key={i} x1="58" y1={76+i*3.2} x2="142" y2={76+i*3.2}/>)}
        </g>
        {/* hem rib detail */}
        <line x1="58" y1="128" x2="142" y2="128" stroke="#0A0A0C" strokeWidth="1"/>
        {/* highlight */}
        <path d="M75 80 Q100 78 125 80 L120 100 Q100 96 80 100 Z" fill="#fff" opacity="0.04"/>
      </g>
    </svg>
  );
}

function BasicTee({ size = 200, color = CLOTHES_PALETTE.beige }) {
  const id = 'bt'+color.slice(1);
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.85"/>
          <stop offset="0.5" stopColor={color}/>
          <stop offset="1" stopColor={color} stopOpacity="0.85"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="190" rx="56" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* short sleeves */}
        <path d="M50 70 L42 96 L46 110 L72 108 L70 80 Z" fill={`url(#${id}-g)`}/>
        <path d="M150 70 L158 96 L154 110 L128 108 L130 80 Z" fill={`url(#${id}-g)`}/>
        {/* body */}
        <path d="M70 68 L66 184 Q66 188 70 188 L130 188 Q134 188 134 184 L130 68 L118 60 Q110 70 100 70 Q90 70 82 60 Z"
          fill={`url(#${id}-g)`}/>
        {/* crew neck collar */}
        <path d="M82 60 Q92 70 100 70 Q108 70 118 60 L116 64 Q108 72 100 72 Q92 72 84 64 Z"
          fill="#000" opacity="0.18"/>
        <path d="M84 62 Q92 68 100 68 Q108 68 116 62" stroke="#000" strokeWidth="0.6" fill="none" opacity="0.25"/>
        {/* soft body shadow on sides */}
        <path d="M66 90 L70 185 L74 90 Z" fill="#000" opacity="0.05"/>
        <path d="M134 90 L130 185 L126 90 Z" fill="#000" opacity="0.05"/>
        {/* fold */}
        <path d="M82 100 Q100 110 118 100 Q100 112 82 100" fill="#000" opacity="0.04"/>
      </g>
    </svg>
  );
}

function BlueShirt({ size = 200 }) {
  const id = 'bs'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor={P.lightDenim}/>
          <stop offset="0.5" stopColor={P.lightDenimHi}/>
          <stop offset="1" stopColor={P.lightDenim}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="62" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* long sleeves */}
        <path d="M50 72 Q42 78 38 96 L34 168 Q34 178 44 180 L62 178 L66 96 Q60 78 62 74 Z" fill={`url(#${id}-g)`}/>
        <path d="M150 72 Q158 78 162 96 L166 168 Q166 178 156 180 L138 178 L134 96 Q140 78 138 74 Z" fill={`url(#${id}-g)`}/>
        {/* cuffs */}
        <rect x="40" y="170" width="22" height="10" rx="1" fill={P.midDenim}/>
        <rect x="138" y="170" width="22" height="10" rx="1" fill={P.midDenim}/>
        {/* body */}
        <path d="M62 68 L54 80 L52 188 Q52 192 56 192 L144 192 Q148 192 148 188 L146 80 L138 68 L120 60 L100 70 L80 60 Z"
          fill={`url(#${id}-g)`}/>
        {/* collar */}
        <path d="M78 60 L74 76 L92 78 L100 70 Z" fill={P.midDenim}/>
        <path d="M122 60 L126 76 L108 78 L100 70 Z" fill={P.midDenim}/>
        <path d="M78 60 L74 76 L92 78 L100 70 Z" fill="none" stroke={P.denim} strokeWidth="0.5"/>
        <path d="M122 60 L126 76 L108 78 L100 70 Z" fill="none" stroke={P.denim} strokeWidth="0.5"/>
        {/* placket */}
        <rect x="97" y="78" width="6" height="114" fill={P.midDenim} opacity="0.4"/>
        <line x1="100" y1="78" x2="100" y2="192" stroke={P.midDenim} strokeWidth="0.5"/>
        {/* topstitching */}
        <line x1="96" y1="78" x2="96" y2="192" stroke={P.midDenim} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        <line x1="104" y1="78" x2="104" y2="192" stroke={P.midDenim} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        {/* buttons */}
        {[92, 112, 132, 152, 172].map(y => (
          <circle key={y} cx="100" cy={y} r="1.4" fill={P.white} stroke={P.midDenim} strokeWidth="0.3"/>
        ))}
        {/* chest pocket */}
        <path d="M66 92 L86 92 L86 110 L66 110 Z" fill="none" stroke={P.midDenim} strokeWidth="0.5"/>
        <path d="M66 92 L86 92 L84 96 L68 96 Z" fill={P.midDenim} opacity="0.2"/>
        {/* shading */}
        <path d="M54 80 L52 188 L60 188 L62 80 Z" fill="#000" opacity="0.05"/>
        <path d="M146 80 L148 188 L140 188 L138 80 Z" fill="#000" opacity="0.05"/>
        {/* fabric folds */}
        <path d="M70 130 Q90 140 100 138" fill="none" stroke={P.denim} strokeWidth="0.3" opacity="0.4"/>
        <path d="M130 130 Q110 140 100 138" fill="none" stroke={P.denim} strokeWidth="0.3" opacity="0.4"/>
      </g>
    </svg>
  );
}

function GrayHoodie({ size = 200 }) {
  const id = 'gh'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor={P.gray}/>
          <stop offset="0.5" stopColor={P.grayHi}/>
          <stop offset="1" stopColor={P.gray}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="64" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* sleeves */}
        <path d="M48 76 Q40 84 36 102 L30 170 Q30 180 40 182 L62 178 L64 100 Q60 88 60 80 Z" fill={`url(#${id}-g)`}/>
        <path d="M152 76 Q160 84 164 102 L170 170 Q170 180 160 182 L138 178 L136 100 Q140 88 140 80 Z" fill={`url(#${id}-g)`}/>
        {/* cuffs ribbed */}
        <rect x="38" y="170" width="22" height="10" fill={P.grayLo}/>
        <rect x="140" y="170" width="22" height="10" fill={P.grayLo}/>
        {Array.from({length:4},(_,i)=> <line key={`l${i}`} x1={38} y1={172+i*2} x2={60} y2={172+i*2} stroke={P.gray} strokeWidth="0.3"/>)}
        {Array.from({length:4},(_,i)=> <line key={`r${i}`} x1={140} y1={172+i*2} x2={162} y2={172+i*2} stroke={P.gray} strokeWidth="0.3"/>)}
        {/* hood — thick collar */}
        <path d="M70 60 Q100 38 130 60 L132 80 Q120 70 100 70 Q80 70 68 80 Z" fill={`url(#${id}-g)`}/>
        <path d="M70 60 Q100 38 130 60" fill="none" stroke={P.grayLo} strokeWidth="1"/>
        <path d="M84 70 Q100 64 116 70 L114 84 Q100 78 86 84 Z" fill={P.grayLo} opacity="0.5"/>
        {/* body */}
        <path d="M58 76 L52 90 L50 190 Q50 194 54 194 L146 194 Q150 194 150 190 L148 90 L142 76 L130 68 Q120 76 100 76 Q80 76 70 68 Z"
          fill={`url(#${id}-g)`}/>
        {/* kangaroo pocket */}
        <path d="M72 130 Q72 122 80 120 L120 120 Q128 122 128 130 L132 162 Q132 168 124 168 L76 168 Q68 168 68 162 Z"
          fill={P.lightGray} opacity="0.4"/>
        <path d="M72 130 Q72 122 80 120 L120 120 Q128 122 128 130 L132 162 Q132 168 124 168 L76 168 Q68 168 68 162 Z"
          fill="none" stroke={P.grayLo} strokeWidth="0.5"/>
        <line x1="100" y1="124" x2="100" y2="166" stroke={P.grayLo} strokeWidth="0.4" opacity="0.6"/>
        {/* drawstrings */}
        <line x1="92" y1="78" x2="88" y2="106" stroke={P.white} strokeWidth="2" strokeLinecap="round"/>
        <line x1="108" y1="78" x2="112" y2="106" stroke={P.white} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="88" cy="106" r="1.6" fill={P.white}/>
        <circle cx="112" cy="106" r="1.6" fill={P.white}/>
        {/* hem rib */}
        <rect x="50" y="186" width="100" height="8" fill={P.grayLo} opacity="0.4"/>
        {/* shading */}
        <path d="M52 90 L50 190 L60 190 L60 92 Z" fill="#000" opacity="0.05"/>
        <path d="M148 90 L150 190 L140 190 L140 92 Z" fill="#000" opacity="0.05"/>
      </g>
    </svg>
  );
}

function CardiganGray({ size = 200 }) {
  const id = 'cg'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#5E6263"/>
          <stop offset="0.5" stopColor="#8A8E90"/>
          <stop offset="1" stopColor="#5E6263"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="64" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* sleeves */}
        <path d="M48 72 Q40 80 36 98 L30 172 Q30 182 40 184 L62 180 L64 96 Q58 80 60 76 Z" fill={`url(#${id}-g)`}/>
        <path d="M152 72 Q160 80 164 98 L170 172 Q170 182 160 184 L138 180 L136 96 Q142 80 140 76 Z" fill={`url(#${id}-g)`}/>
        {/* body — open V */}
        <path d="M58 70 L50 84 L46 192 Q46 196 50 196 L150 196 Q154 196 154 192 L150 84 L142 70 L120 60 L100 80 L80 60 Z"
          fill={`url(#${id}-g)`}/>
        {/* V neck shadow */}
        <path d="M80 60 L100 80 L120 60 L118 64 L100 84 L82 64 Z" fill="#3D4042"/>
        {/* placket */}
        <rect x="96" y="80" width="8" height="116" fill="#5E6263"/>
        {/* knit ribbing — vertical lines */}
        <g opacity="0.4" stroke="#3D4042" strokeWidth="0.4">
          {Array.from({length: 22}, (_,i) => <line key={i} x1={50+i*5} y1="84" x2={50+i*5} y2="194"/>)}
        </g>
        {/* horizontal knit cross */}
        <g opacity="0.18" stroke="#3D4042" strokeWidth="0.3">
          {Array.from({length: 24}, (_,i) => <line key={i} x1="50" y1={86+i*5} x2="150" y2={86+i*5}/>)}
        </g>
        {/* buttons */}
        {[92, 112, 132, 152, 172, 188].map(y => (
          <g key={y}>
            <circle cx="100" cy={y} r="2.2" fill="#2A2D2E"/>
            <circle cx="100" cy={y} r="1.5" fill="#3D4042" stroke="#1A1C1D" strokeWidth="0.2"/>
          </g>
        ))}
        {/* shading */}
        <path d="M50 84 L46 192 L56 192 L58 84 Z" fill="#000" opacity="0.1"/>
        <path d="M150 84 L154 192 L144 192 L142 84 Z" fill="#000" opacity="0.1"/>
        {/* ribbed hem */}
        <rect x="46" y="188" width="108" height="8" fill="#3D4042" opacity="0.4"/>
      </g>
    </svg>
  );
}

// ─── BOTTOMS ────────────────────────────────────────────────
function DenimSkirt({ size = 200 }) {
  const id = 'ds'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor={P.denimLo}/>
          <stop offset="0.5" stopColor={P.denim}/>
          <stop offset="1" stopColor={P.denimLo}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="195" rx="64" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* main body — A-line */}
        <path d="M62 50 L60 64 L42 188 Q42 192 46 192 L154 192 Q158 192 156 188 L138 64 L138 50 Z"
          fill={`url(#${id}-g)`}/>
        {/* waistband */}
        <rect x="62" y="48" width="76" height="16" fill={P.denimLo}/>
        <rect x="62" y="48" width="76" height="16" fill="none" stroke={P.denim} strokeWidth="0.4"/>
        {/* belt loops */}
        {[68, 90, 110, 132].map(x => (
          <rect key={x} x={x} y="46" width="3" height="20" fill={P.denimLo}/>
        ))}
        {/* button */}
        <circle cx="92" cy="56" r="2.5" fill="#C8A560"/>
        <circle cx="92" cy="56" r="1.8" fill="#A88440"/>
        {/* fly stitching */}
        <path d="M100 64 L100 90" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 1.5"/>
        {/* gold topstitch on waistband */}
        <line x1="62" y1="50" x2="138" y2="50" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5" opacity="0.8"/>
        <line x1="62" y1="62" x2="138" y2="62" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5" opacity="0.8"/>
        {/* pockets — front */}
        <path d="M62 64 L80 64 L72 88 L62 86 Z" fill="none" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        <path d="M138 64 L120 64 L128 88 L138 86 Z" fill="none" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        {/* center seam */}
        <line x1="100" y1="64" x2="100" y2="190" stroke={P.denim} strokeWidth="0.5" opacity="0.4"/>
        {/* fabric texture — diagonal denim weave */}
        <g opacity="0.08" stroke={P.denimHi} strokeWidth="0.3">
          {Array.from({length: 30}, (_,i) => <line key={i} x1={50+i*4} y1="64" x2={70+i*4} y2="194"/>)}
        </g>
        {/* fade highlight */}
        <ellipse cx="100" cy="120" rx="20" ry="40" fill={P.denimHi} opacity="0.2"/>
        {/* hem */}
        <line x1="44" y1="186" x2="156" y2="186" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 1.5" opacity="0.7"/>
      </g>
    </svg>
  );
}

function BlackPants({ size = 200 }) {
  const id = 'bp';
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#0A0A0C"/>
          <stop offset="0.5" stopColor="#2A2A2D"/>
          <stop offset="1" stopColor="#0A0A0C"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="58" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* waistband */}
        <rect x="64" y="44" width="72" height="14" fill="#0F0F11"/>
        {/* legs — wide */}
        <path d="M64 56 L56 110 L48 196 Q48 198 50 198 L92 198 Q94 198 94 196 L98 116 L102 116 L106 196 Q106 198 108 198 L150 198 Q152 198 152 196 L144 110 L136 56 Z"
          fill={`url(#${id}-g)`}/>
        {/* center crease */}
        <line x1="74" y1="68" x2="68" y2="195" stroke="#3F3F42" strokeWidth="0.5" opacity="0.6"/>
        <line x1="126" y1="68" x2="132" y2="195" stroke="#3F3F42" strokeWidth="0.5" opacity="0.6"/>
        {/* fly */}
        <line x1="100" y1="58" x2="100" y2="116" stroke="#0A0A0C" strokeWidth="0.5"/>
        <path d="M97 58 L97 88" stroke="#3F3F42" strokeWidth="0.3" strokeDasharray="1.5 1"/>
        {/* pockets */}
        <path d="M68 60 L88 60 L82 78 L68 76 Z" fill="none" stroke="#3F3F42" strokeWidth="0.4"/>
        <path d="M132 60 L112 60 L118 78 L132 76 Z" fill="none" stroke="#3F3F42" strokeWidth="0.4"/>
        {/* button */}
        <circle cx="92" cy="51" r="1.6" fill="#3F3F42"/>
        {/* fabric folds */}
        <path d="M58 110 Q66 130 60 195" fill="none" stroke="#000" strokeWidth="2" opacity="0.15"/>
        <path d="M142 110 Q134 130 140 195" fill="none" stroke="#000" strokeWidth="2" opacity="0.15"/>
        <path d="M82 130 Q88 160 86 195" fill="none" stroke="#3F3F42" strokeWidth="0.4" opacity="0.5"/>
        <path d="M118 130 Q112 160 114 195" fill="none" stroke="#3F3F42" strokeWidth="0.4" opacity="0.5"/>
      </g>
    </svg>
  );
}

function Shorts({ size = 200 }) {
  const id = 'sh'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#1A1A1C"/>
          <stop offset="0.5" stopColor="#3A3A3D"/>
          <stop offset="1" stopColor="#1A1A1C"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="160" rx="56" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        <rect x="62" y="60" width="76" height="14" fill="#0F0F11"/>
        <path d="M62 72 L58 84 L52 154 Q52 158 56 158 L94 158 L98 110 L102 110 L106 158 L144 158 Q148 158 148 154 L142 84 L138 72 Z"
          fill={`url(#${id}-g)`}/>
        {/* hem rolled */}
        <rect x="52" y="148" width="42" height="10" fill="#0A0A0C" opacity="0.5"/>
        <rect x="106" y="148" width="42" height="10" fill="#0A0A0C" opacity="0.5"/>
        {/* fly */}
        <line x1="100" y1="74" x2="100" y2="110" stroke="#0A0A0C" strokeWidth="0.5"/>
        {/* pockets */}
        <path d="M64 74 L84 74 L80 92 L64 90 Z" fill="none" stroke="#3A3A3D" strokeWidth="0.4"/>
        <path d="M136 74 L116 74 L120 92 L136 90 Z" fill="none" stroke="#3A3A3D" strokeWidth="0.4"/>
        {/* button */}
        <circle cx="91" cy="67" r="1.5" fill="#3A3A3D"/>
        {/* drawstring/elastic suggestion */}
        <line x1="62" y1="62" x2="138" y2="62" stroke="#3A3A3D" strokeWidth="0.3" strokeDasharray="1.5 1"/>
      </g>
    </svg>
  );
}

function BlueJeans({ size = 200 }) {
  const id = 'bj'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor={P.denim}/>
          <stop offset="0.5" stopColor={P.denimHi}/>
          <stop offset="1" stopColor={P.denim}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="200" rx="58" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        <rect x="64" y="44" width="72" height="14" fill={P.denimLo}/>
        <path d="M64 56 L56 116 L50 196 Q50 198 52 198 L92 198 L98 122 L102 122 L108 198 L148 198 Q150 198 150 196 L144 116 L136 56 Z"
          fill={`url(#${id}-g)`}/>
        {/* center seam */}
        <line x1="100" y1="58" x2="100" y2="122" stroke={P.denimLo} strokeWidth="0.5"/>
        {/* belt loops */}
        {[68, 90, 110, 132].map(x => <rect key={x} x={x} y="42" width="3" height="18" fill={P.denimLo}/>)}
        {/* gold stitching */}
        <line x1="64" y1="46" x2="136" y2="46" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        <line x1="64" y1="56" x2="136" y2="56" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        {/* pockets */}
        <path d="M68 58 L86 58 L80 78 L66 76 Z" fill="none" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        <path d="M132 58 L114 58 L120 78 L134 76 Z" fill="none" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        {/* fly */}
        <path d="M97 58 L97 90" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5"/>
        {/* button */}
        <circle cx="92" cy="51" r="2.2" fill={P.gold}/>
        <circle cx="92" cy="51" r="1.5" fill="#A88440"/>
        {/* knee fade */}
        <ellipse cx="80" cy="140" rx="10" ry="22" fill={P.denimHi} opacity="0.5"/>
        <ellipse cx="120" cy="140" rx="10" ry="22" fill={P.denimHi} opacity="0.5"/>
        {/* outseam */}
        <line x1="56" y1="116" x2="50" y2="195" stroke={P.gold} strokeWidth="0.3" strokeDasharray="1.5 1"/>
        <line x1="144" y1="116" x2="150" y2="195" stroke={P.gold} strokeWidth="0.3" strokeDasharray="1.5 1"/>
      </g>
    </svg>
  );
}

// ─── SHOES ──────────────────────────────────────────────────
function ChelseaBoots({ size = 200 }) {
  const id = 'cb'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={P.brownHi}/>
          <stop offset="0.5" stopColor={P.brown}/>
          <stop offset="1" stopColor={P.espresso}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="110" cy="156" rx="60" ry="6" opacity="0.25"/>
      <g filter={`url(#sh-${id})`}>
        {/* sole */}
        <path d="M48 142 Q48 154 60 156 L168 154 Q176 152 174 142 L172 138 Q120 138 50 138 Z" fill={P.espresso}/>
        <path d="M48 142 L174 142" stroke="#1A0F08" strokeWidth="0.6"/>
        {/* shaft */}
        <path d="M68 50 Q66 60 68 70 L70 130 Q70 138 80 138 L156 138 Q170 138 174 130 L172 116 Q160 110 138 110 L138 60 Q138 52 130 50 L80 48 Q70 48 68 50 Z"
          fill={`url(#${id}-g)`}/>
        {/* shaft pull tab */}
        <path d="M80 48 L80 56 L96 56 L96 48 Z" fill={P.brown}/>
        {/* elastic side gore */}
        <path d="M132 70 Q138 72 140 78 L140 102 Q138 108 132 110 L120 110 L120 70 Z" fill={P.camel} opacity="0.85"/>
        {/* elastic ribs */}
        <g stroke={P.brown} strokeWidth="0.4" opacity="0.5">
          {Array.from({length:8},(_,i)=> <line key={i} x1="120" y1={72+i*5} x2="138" y2={72+i*5}/>)}
        </g>
        {/* toe cap shading */}
        <path d="M155 130 Q170 128 174 124 L174 130 Q170 134 155 134 Z" fill="#000" opacity="0.18"/>
        {/* highlight */}
        <path d="M88 60 Q108 56 122 60 L120 78 Q104 74 90 78 Z" fill="#fff" opacity="0.12"/>
        {/* stitching topline */}
        <path d="M68 70 L138 70" stroke={P.tan} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        <path d="M68 60 L138 60" stroke={P.tan} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        {/* heel block */}
        <path d="M52 138 L60 154 L72 154 L70 138 Z" fill={P.espresso}/>
      </g>
    </svg>
  );
}

function WhiteBoots({ size = 200 }) {
  const id = 'wb'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8F5EC"/>
          <stop offset="0.6" stopColor="#EAE2D2"/>
          <stop offset="1" stopColor="#C9BD9F"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="110" cy="158" rx="60" ry="6" opacity="0.25"/>
      <g filter={`url(#sh-${id})`}>
        {/* lug sole */}
        <path d="M44 144 Q44 158 60 160 L170 158 Q180 156 178 144 L176 138 Q120 138 48 138 Z" fill="#3D3025"/>
        {[50,62,74,86,98,110,122,134,146,158,170].map(x => <line key={x} x1={x} y1="146" x2={x} y2="158" stroke="#1A1208" strokeWidth="0.5"/>)}
        {/* shaft */}
        <path d="M70 44 Q68 56 70 70 L70 130 Q70 138 80 138 L160 138 Q174 136 176 128 L174 116 Q162 110 138 110 L138 54 Q138 46 130 44 L80 42 Q70 42 70 44 Z"
          fill={`url(#${id}-g)`}/>
        {/* lacing */}
        {[60, 76, 92, 108, 124].map((y,i) => (
          <g key={y}>
            <circle cx="98" cy={y} r="1.5" fill="#3D3025"/>
            <circle cx="118" cy={y} r="1.5" fill="#3D3025"/>
            {i < 4 && <line x1="98" y1={y} x2="118" y2={y+8} stroke={P.beige} strokeWidth="1.2"/>}
            {i < 4 && <line x1="118" y1={y} x2="98" y2={y+8} stroke={P.beige} strokeWidth="1.2"/>}
          </g>
        ))}
        {/* tongue */}
        <path d="M100 50 L116 50 L118 124 L98 124 Z" fill={P.creamHi}/>
        <path d="M100 50 L116 50 L118 124 L98 124 Z" fill="none" stroke={P.creamLo} strokeWidth="0.4"/>
        {/* highlight */}
        <path d="M76 56 Q88 50 96 50 L96 110 Q86 110 78 110 Z" fill="#fff" opacity="0.3"/>
        {/* topline stitching */}
        <path d="M70 56 L138 56" stroke={P.creamLo} strokeWidth="0.3" strokeDasharray="1.5 1" opacity="0.7"/>
        {/* heel */}
        <path d="M52 138 L48 158 L72 158 L72 138 Z" fill={P.creamLo}/>
      </g>
    </svg>
  );
}

function TallBoots({ size = 200 }) {
  const id = 'tb'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#7A2818"/>
          <stop offset="0.5" stopColor="#5C1810"/>
          <stop offset="1" stopColor="#2E0808"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="118" cy="178" rx="55" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* sole */}
        <path d="M76 162 Q76 172 86 174 L162 172 Q172 170 170 162 L168 158 Q120 158 78 158 Z" fill={P.espresso}/>
        {/* tall shaft */}
        <path d="M84 22 Q82 32 84 42 L82 156 Q82 164 92 164 L160 162 Q172 160 172 152 L170 138 Q156 132 138 132 L138 30 Q138 22 130 22 L92 22 Q84 22 84 22 Z"
          fill={`url(#${id}-g)`}/>
        {/* knee fold suggestion */}
        <path d="M84 60 Q100 58 138 60" stroke="#3A0A0A" strokeWidth="0.5" opacity="0.5" fill="none"/>
        <path d="M84 100 Q100 98 138 100" stroke="#3A0A0A" strokeWidth="0.5" opacity="0.5" fill="none"/>
        {/* toe shading */}
        <path d="M150 152 Q170 150 172 144 L170 152 Q160 158 150 158 Z" fill="#000" opacity="0.2"/>
        {/* highlight */}
        <path d="M96 32 Q108 28 122 32 L122 130 Q108 130 96 130 Z" fill="#fff" opacity="0.08"/>
        {/* heel */}
        <path d="M86 158 L82 174 L98 174 L100 158 Z" fill={P.espresso}/>
        {/* zipper */}
        <line x1="92" y1="36" x2="92" y2="150" stroke="#2A0808" strokeWidth="0.6"/>
        {Array.from({length: 30}, (_,i) => <line key={i} x1="90" y1={36+i*4} x2="94" y2={36+i*4} stroke="#1A0404" strokeWidth="0.3"/>)}
      </g>
    </svg>
  );
}

// ─── BAGS ───────────────────────────────────────────────────
function ShoulderBag({ size = 200 }) {
  const id = 'sb'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.tanHi}/>
          <stop offset="0.5" stopColor={P.tan}/>
          <stop offset="1" stopColor={P.tanLo}/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="170" rx="58" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* strap */}
        <path d="M58 84 Q70 36 100 32 Q130 36 142 84" fill="none" stroke={P.tanLo} strokeWidth="4" strokeLinecap="round"/>
        <path d="M58 84 Q70 36 100 32 Q130 36 142 84" fill="none" stroke={P.tan} strokeWidth="2" strokeLinecap="round"/>
        {/* hardware ring */}
        <circle cx="58" cy="84" r="4" fill="none" stroke="#A88440" strokeWidth="1.5"/>
        <circle cx="142" cy="84" r="4" fill="none" stroke="#A88440" strokeWidth="1.5"/>
        {/* body — half-moon hobo */}
        <path d="M48 86 Q44 92 44 100 L52 158 Q54 168 64 168 L136 168 Q146 168 148 158 L156 100 Q156 92 152 86 Q120 92 100 90 Q80 92 48 86 Z"
          fill={`url(#${id}-g)`}/>
        {/* top edge highlight */}
        <path d="M50 88 Q80 94 100 92 Q120 94 150 88 L148 96 Q120 102 100 100 Q80 102 52 96 Z" fill={P.tanHi} opacity="0.6"/>
        {/* center seam */}
        <line x1="100" y1="92" x2="100" y2="166" stroke={P.tanLo} strokeWidth="0.5" opacity="0.5"/>
        {/* topstitching curve */}
        <path d="M50 96 Q100 110 150 96" fill="none" stroke={P.gold} strokeWidth="0.4" strokeDasharray="2 1.5" opacity="0.7"/>
        {/* bottom shading */}
        <path d="M52 158 Q54 168 64 168 L136 168 Q146 168 148 158 L144 154 Q100 162 56 154 Z" fill="#000" opacity="0.15"/>
        {/* leather grain texture */}
        <g opacity="0.06" fill={P.tanLo}>
          {Array.from({length: 30}, (_,i) => <circle key={i} cx={50 + (i*7)%100} cy={100 + Math.floor(i/14)*20 + (i*3)%10} r="0.6"/>)}
        </g>
      </g>
    </svg>
  );
}

function BlackHoboBag({ size = 200 }) {
  const id = 'hb'; const P = CLOTHES_PALETTE;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E2E30"/>
          <stop offset="0.5" stopColor="#1A1A1C"/>
          <stop offset="1" stopColor="#0A0A0C"/>
        </linearGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="180" rx="50" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* strap */}
        <path d="M70 64 Q88 30 100 28 Q112 30 130 64" fill="none" stroke="#0A0A0C" strokeWidth="5" strokeLinecap="round"/>
        <path d="M70 64 Q88 30 100 28 Q112 30 130 64" fill="none" stroke="#3A3A3D" strokeWidth="2" strokeLinecap="round"/>
        {/* slouchy body */}
        <path d="M55 64 Q50 90 56 130 Q62 168 100 174 Q138 168 144 130 Q150 90 145 64 Q130 78 116 76 Q108 80 100 80 Q92 80 84 76 Q70 78 55 64 Z"
          fill={`url(#${id}-g)`}/>
        {/* slouch fold lines */}
        <path d="M60 90 Q80 110 70 150" stroke="#000" strokeWidth="1" opacity="0.4" fill="none"/>
        <path d="M140 90 Q120 110 130 150" stroke="#000" strokeWidth="1" opacity="0.4" fill="none"/>
        <path d="M85 100 Q100 130 100 170" stroke="#3A3A3D" strokeWidth="0.4" opacity="0.5" fill="none"/>
        {/* highlight */}
        <path d="M75 80 Q100 86 125 80 L120 130 Q100 134 80 130 Z" fill="#fff" opacity="0.04"/>
        {/* zip */}
        <path d="M70 70 Q100 78 130 70" stroke="#3A3A3D" strokeWidth="0.6" fill="none"/>
        <circle cx="100" cy="76" r="2" fill="#5A5A5D"/>
      </g>
    </svg>
  );
}

// ─── HEADWEAR ───────────────────────────────────────────────
function BlackHat({ size = 200 }) {
  const id = 'bh';
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <defs>
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#3A3A3D"/>
          <stop offset="1" stopColor="#0A0A0C"/>
        </radialGradient>
      </defs>
      <GroundShadow id={id} cx="100" cy="148" rx="60" ry="5"/>
      <g filter={`url(#sh-${id})`}>
        {/* brim */}
        <ellipse cx="100" cy="138" rx="68" ry="14" fill={`url(#${id}-g)`}/>
        <ellipse cx="100" cy="135" rx="68" ry="14" fill="#0A0A0C"/>
        <ellipse cx="100" cy="135" rx="68" ry="14" fill="none" stroke="#2A2A2D" strokeWidth="0.4"/>
        {/* crown */}
        <path d="M64 135 Q66 64 100 60 Q134 64 136 135 Z" fill={`url(#${id}-g)`}/>
        {/* dent */}
        <path d="M76 80 Q100 90 124 80 Q100 100 76 80" fill="#000" opacity="0.4"/>
        {/* band */}
        <ellipse cx="100" cy="118" rx="36" ry="6" fill="#1A1A1C"/>
        <ellipse cx="100" cy="118" rx="36" ry="6" fill="none" stroke="#2A2A2D" strokeWidth="0.3"/>
        {/* highlight */}
        <ellipse cx="86" cy="90" rx="10" ry="20" fill="#fff" opacity="0.05"/>
      </g>
    </svg>
  );
}

function Glasses({ size = 200 }) {
  const id = 'gl';
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <ClothDefs id={id}/>
      <GroundShadow id={id} cx="100" cy="130" rx="70" ry="3"/>
      <g filter={`url(#sh-${id})`} fill="none" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round">
        <path d="M22 102 L40 92"/>
        <path d="M178 102 L160 92"/>
        <ellipse cx="62" cy="100" rx="30" ry="20" fill="#F5F1EA" fillOpacity="0.3"/>
        <ellipse cx="138" cy="100" rx="30" ry="20" fill="#F5F1EA" fillOpacity="0.3"/>
        <line x1="92" y1="98" x2="108" y2="98"/>
      </g>
      <ellipse cx="55" cy="92" rx="6" ry="3" fill="#fff" opacity="0.4"/>
      <ellipse cx="131" cy="92" rx="6" ry="3" fill="#fff" opacity="0.4"/>
    </svg>
  );
}

// ─── OUTFIT COMPOSITIONS ────────────────────────────────────
// Layout pieces like a flat-lay photo. Tops are placed at top with skirt/pants
// directly below — the top should overlap the waistband so it reads as a
// styled outfit rather than a stack of separate items.
function OutfitA({ size = 200 }) {
  // Cropped top + black pants + jacket on the side + boots + hat
  return (
    <svg viewBox="0 0 240 240" width={size} height={size}>
      {/* center: cropped top above pants — overlap so it reads as a body */}
      <g transform="translate(70 30) scale(0.55)"><CroppedTop size={200}/></g>
      <g transform="translate(70 105) scale(0.55)"><BlackPants size={200}/></g>
      {/* shearling jacket — left side, slightly behind */}
      <g transform="translate(0 40) scale(0.55)"><ShearlingJacket size={200}/></g>
      {/* boots — bottom */}
      <g transform="translate(140 175) scale(0.32)"><WhiteBoots size={200}/></g>
      {/* hat — top corner */}
      <g transform="translate(150 0) scale(0.32)"><BlackHat size={200}/></g>
    </svg>
  );
}

function OutfitB({ size = 200 }) {
  // Blue shirt + denim skirt + hobo bag
  return (
    <svg viewBox="0 0 240 240" width={size} height={size}>
      <g transform="translate(50 20) scale(0.55)"><BlueShirt size={200}/></g>
      <g transform="translate(50 110) scale(0.55)"><DenimSkirt size={200}/></g>
      <g transform="translate(150 60) scale(0.45)"><BlackHoboBag size={200}/></g>
      <g transform="translate(40 195) scale(0.28)"><ChelseaBoots size={200}/></g>
      <g transform="translate(110 195) scale(0.28)"><ChelseaBoots size={200}/></g>
    </svg>
  );
}

Object.assign(window, {
  CLOTHES_PALETTE,
  ShearlingJacket, CroppedTop, BasicTee, BlueShirt, GrayHoodie, CardiganGray,
  DenimSkirt, BlackPants, Shorts, BlueJeans,
  ChelseaBoots, WhiteBoots, TallBoots,
  ShoulderBag, BlackHoboBag,
  BlackHat, Glasses,
  OutfitA, OutfitB,
});
