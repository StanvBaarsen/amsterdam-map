import React, { useMemo } from 'react';
import './PopulationChart.css';

interface PopulationDataPoint {
    year: number;
    pop: number;
}

const POPULATION_DATA: PopulationDataPoint[] = [
    { year: 1000, pop: 0 },
    { year: 1175, pop: 100 },
    { year: 1250, pop: 500 },
    { year: 1275, pop: 1000 },
    { year: 1560, pop: 30000 },
    { year: 1600, pop: 80000 },
    { year: 1700, pop: 225000 },
    { year: 1800, pop: 215000 },
    { year: 1900, pop: 510000 },
    { year: 2000, pop: 731000 },
    { year: 2024, pop: 931000 }
];

interface PopulationChartProps {
    currentYear: number;
    onOpenAbout?: () => void;
}

export const PopulationChart: React.FC<PopulationChartProps> = ({ currentYear, onOpenAbout }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    // Filter active data
    const activeData = useMemo(() => {
        return POPULATION_DATA.filter(d => d.year <= currentYear);
    }, [currentYear]);
    
    // ... rest of logic

    const currentPopulation = useMemo(() => {
        if (activeData.length === 0) return 0;
        return activeData[activeData.length - 1].pop; // Use last known point
    }, [activeData]);
    
    const latestDataYear = useMemo(() => {
        if (activeData.length === 0) return currentYear;
        return activeData[activeData.length - 1].year;
    }, [activeData, currentYear]);

    // ----- Scales -----
    const minYear = 1000;
    
    // Y-Axis Max (Population)
    // We want nice round numbers above the max.
    const maxPop = useMemo(() => {
        if (activeData.length === 0) return 1000;
        const rawMax = Math.max(...activeData.map(d => d.pop));
        // Nice number logic:
        if (rawMax === 0) return 1000;
        
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
        // Use 5 ticks target logic for nice numbers
        const niceMax = Math.ceil(rawMax / (magnitude/2)) * (magnitude/2);
        return niceMax > rawMax ? niceMax : niceMax + (magnitude/2);
    }, [activeData]);

    // X-Axis Max (Year)
    const maxYear = useMemo(() => {
        if (activeData.length === 0) return minYear + 100;
        const lastYear = activeData[activeData.length - 1].year;
        return lastYear > minYear ? lastYear : minYear + 100;
    }, [activeData]);

    // ----- CHART DRAWING HELPER -----
    // Dimensions context (Coordinate System 0..100)
    // We will scale everything to 0..100 internally for paths
    const getX = (year: number) => {
        const range = maxYear - minYear;
        if (range <= 0) return 0;
        return ((year - minYear) / range) * 100;
    };
    const getY = (pop: number) => {
        if (maxPop <= 0) return 100;
        return 100 - (pop / maxPop) * 100;
    };

    // ----- TICKS GENERATION -----
    
    // Y-Axis Ticks (Population)
    // Generate ~4-5 nice ticks
    const yTicks = useMemo(() => {
        if (maxPop <= 0) return [];
        const tickCount = 4;
        const step = maxPop / tickCount; 
        
        const ticks = [];
        for (let i = 1; i <= tickCount; i++) {
            ticks.push(Math.round(step * i)); 
        }
        return ticks; 
    }, [maxPop]);

    // X-Axis Ticks (Year)
    // "each 200 years or so"
    const xTicks = useMemo(() => {
        const ticks = [];
        for (let y = 1000; y <= maxYear; y += 200) {
            ticks.push(y);
        }
        return ticks;
    }, [maxYear]);


    // ----- RENDERING CONFIG -----
    // Expanded Chart Config
    const chartW = 380;  
    const chartH = 220;  
    const margin = { top: 20, right: 30, bottom: 40, left: 50 }; 
    
    // Collapsed Chart Config (Small)
    const smallW = 150;
    const smallMargin = { top: 5, right: 5, bottom: 5, left: 5 }; 

    // Helper to map normalized 0..100 coords to pixels
    const mapPt = (xNorm: number, yNorm: number, w: number, h: number, m: any) => {
        const drawW = w - m.left - m.right;
        const drawH = h - m.top - m.bottom;
        return {
            x: m.left + (xNorm / 100) * drawW,
            y: m.top + (yNorm / 100) * drawH
        };
    };

    // Label collision heuristic for data points
    const visibleLabels: boolean[] = useMemo(() => {
        if (activeData.length === 0) return [];
        const flags = new Array(activeData.length).fill(false);
        const pixelPoints = activeData.map(d => mapPt(getX(d.year), getY(d.pop), chartW, chartH, margin));
        
        // Prioritize last point
        const lastIdx = activeData.length - 1;
        flags[lastIdx] = true;
        
        // Check others against already visible ones
        for (let i = lastIdx - 1; i >= 0; i--) {
            let collides = false;
            // Check against all subsequently flagged points
            for (let j = i + 1; j < activeData.length; j++) {
                if (flags[j]) {
                    // Distance check. Label size approx 30px width, 15px height
                    const dy = Math.abs(pixelPoints[i].y - pixelPoints[j].y);
                    const dx = Math.abs(pixelPoints[i].x - pixelPoints[j].x);
                    
                    // Simple box collision approximation
                    if (dy < 15 && dx < 40) {
                        collides = true;
                        break;
                    }
                }
            }
            if (!collides) {
                flags[i] = true;
            }
        }
        return flags;
    }, [activeData, maxPop, maxYear]); // recalculate if data/scale changes

    // Sub-render function for the chart content
    const renderChart = (w: number, h: number, m: any, isExpanded: boolean) => {
        // Generate path string in pixel coords
        let d = "";
        if (activeData.length > 0) {
            const first = mapPt(getX(activeData[0].year), getY(activeData[0].pop), w, h, m);
            d = `M ${first.x} ${first.y}`;
            for (let i = 1; i < activeData.length; i++) {
                const pt = mapPt(getX(activeData[i].year), getY(activeData[i].pop), w, h, m);
                d += ` L ${pt.x} ${pt.y}`;
            }
        }

        return (
            <svg 
                width="100%" 
                height="100%" 
                viewBox={`0 0 ${w} ${h}`} 
                preserveAspectRatio={isExpanded ? "xMidYMid meet" : "none"}
                style={{ overflow: 'visible' }} 
            >
                 {/* Axes Lines */}
                 <line 
                    x1={m.left} y1={h - m.bottom} 
                    x2={w - m.right} y2={h - m.bottom} 
                    stroke="#8d6e63"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                 />
                 <line 
                    x1={m.left} y1={h - m.bottom} 
                    x2={m.left} y2={m.top} 
                    stroke="#8d6e63"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                 />

                 {/* Grid Lines */}
                 {yTicks.map(val => {
                     const yPos = mapPt(0, getY(val), w, h, m).y;
                     return (
                         <g key={'grid-'+val}>
                            <line 
                                x1={m.left} y1={yPos} 
                                x2={w - m.right} y2={yPos}
                                stroke="#ccc" 
                                strokeDasharray="4" 
                                opacity="0.5"
                                vectorEffect="non-scaling-stroke"
                            />
                            {isExpanded && (
                                <text 
                                    x={m.left - 8} 
                                    y={yPos + 4} 
                                    textAnchor="end" 
                                    fill="#3e2723"
                                    style={{ fontSize: '11px', fontWeight: 'normal', fontFamily: 'Georgia, serif' }}
                                >
                                    {val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}
                                </text>
                            )}
                         </g>
                     );
                 })}

                 {/* X-Axis Ticks */}
                 {xTicks.map(year => {
                     const xPos = mapPt(getX(year), 0, w, h, m).x;
                     return (
                         <g key={'xtick-'+year}>
                             <line 
                                x1={xPos} y1={h - m.bottom} 
                                x2={xPos} y2={h - m.bottom + 5} 
                                stroke="#8d6e63"
                                vectorEffect="non-scaling-stroke"
                             />
                             {isExpanded && (
                                 <text 
                                    x={xPos} 
                                    y={h - m.bottom + 18} 
                                    fill="#3e2723"
                                    textAnchor="middle" 
                                    style={{ fontSize: '11px', fontFamily: 'Georgia, serif' }}
                                 >
                                     {year}
                                 </text>
                             )}
                         </g>
                     )
                 })}

                 {/* Data Path */}
                 <path 
                    d={d} 
                    fill="none" 
                    stroke="#d84315" 
                    strokeWidth="2" 
                    vectorEffect="non-scaling-stroke" 
                />

                 {/* Data Points */}
                 {activeData.map((d, i) => {
                     const pt = mapPt(getX(d.year), getY(d.pop), w, h, m);
                     const showLabel = visibleLabels[i];
                     
                     return (
                         <g key={i}>
                            <circle 
                                cx={pt.x} cy={pt.y} 
                                r={isExpanded ? 3.5 : 2} 
                                fill="#d84315"
                                vectorEffect="non-scaling-stroke"
                            />
                            
                            {isExpanded && showLabel && (
                                <text 
                                    x={pt.x + 6} 
                                    y={pt.y - 6} 
                                    fill="#3e2723"
                                    style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}
                                >
                                    {d.pop >= 1000 ? (d.pop/1000).toFixed(0) + 'k' : d.pop}
                                </text>
                            )}
                         </g>
                     );
                 })}
            </svg>
        );
    };


    return (
        <div
            className={`population-chart-container ${isHovered ? 'expanded' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* RENDER CONTENT BASED ON STATE */}
            {!isHovered ? (
                <div className="chart-content-wrapper collapsed">
                    <div style={{ 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        marginBottom: '5px', 
                        borderBottom: '1px solid #8d6e63', 
                        paddingBottom: '5px' 
                    }}>
                        Bevolking ({latestDataYear})
                    </div>
                    <div style={{ 
                         fontSize: '18px', 
                         fontWeight: 'bold', 
                         marginBottom: 'auto' 
                    }}>
                        {currentPopulation.toLocaleString('nl-NL')}
                    </div>
                    <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
                        {renderChart(smallW, 80, smallMargin, false)}
                    </div>
                </div>
            ) : (
                <div className="chart-content-wrapper expanded">
                    <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold', 
                        marginBottom: '10px', 
                        borderBottom: '1px solid #8d6e63', 
                        paddingBottom: '5px',
                        whiteSpace: 'nowrap'
                    }}>
                        Bevolkingsgroei Amsterdam
                    </div>
                    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                        {renderChart(chartW, chartH, margin, true)}
                    </div>
                    <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '5px', textAlign: 'right' }}>
                        <button 
                            onClick={(e) => { e.preventDefault(); if(onOpenAbout) onOpenAbout(); }}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: 0, 
                                color: '#5d4037', 
                                textDecoration: 'underline', 
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: 'inherit',
                                fontStyle: 'inherit'
                            }}
                        >
                            Bron: Zie informatiepaneel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
