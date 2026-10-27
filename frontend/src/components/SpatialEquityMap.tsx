import React, { useEffect, useRef, useState, useMemo } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  SurplusPosting,
  Recipient,
  MatchBrief,
  TractDemographics,
  fetchCensusTracts,
} from '../services/brokerApi';
import {
  MapPin,
  Layers,
  Search,
  Focus,
  Maximize2,
  Sparkles,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  Building,
  Info,
  Car,
  AlertTriangle,
} from 'lucide-react';

export type DemographicMetric =
  | 'none'
  | 'no_vehicle_rate'
  | 'poverty_rate'
  | 'assistance_rate'
  | 'median_income';

interface SpatialEquityMapProps {
  postings: SurplusPosting[];
  selectedPosting: SurplusPosting | null;
  currentMatch: MatchBrief | null;
  recipients: Recipient[];
  onSelectPosting: (postingId: number) => void;
  onOpenUpdateModal?: (preselectedRecipientId?: number) => void;
  isDark: boolean;
}

// Atlanta center fallback coordinates
const ATLANTA_CENTER = { lat: 33.7537, lng: -84.3863 };

// Sleek dark obsidian Google Maps style
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#132135' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0b1329' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
];

// Clean tech slate Google Maps style
const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#cbd5e1' }],
  },
];

export const SpatialEquityMap: React.FC<SpatialEquityMapProps> = ({
  selectedPosting,
  currentMatch,
  recipients,
  onOpenUpdateModal,
  isDark,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // References to map objects for cleanup & updates
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const demographicCirclesRef = useRef<google.maps.Circle[]>([]);

  // State
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDemographicMetric, setActiveDemographicMetric] =
    useState<DemographicMetric>('no_vehicle_rate');
  const [tracts, setTracts] = useState<TractDemographics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageFilter, setStorageFilter] = useState<'all' | 'cold' | 'ambient'>(
    'all',
  );

  // Fetch census tracts for demographic layers
  useEffect(() => {
    fetchCensusTracts()
      .then((res) => {
        if (res.tracts && res.tracts.length > 0) {
          setTracts(res.tracts);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch demographic tracts, aggregating from recipients:', err);
        // Fallback: aggregate unique tracts from recipients
        const map = new Map<string, TractDemographics>();
        for (const r of recipients) {
          if (r.tract && r.tract.geo_id && !map.has(r.tract.geo_id)) {
            map.set(r.tract.geo_id, r.tract);
          }
        }
        setTracts(Array.from(map.values()));
      });
  }, [recipients]);

  // Load Google Maps API
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    setOptions({
      key: apiKey,
      v: 'weekly',
    });

    Promise.all([
      importLibrary('maps'),
      importLibrary('core'),
    ])
      .then(() => {
        if (!mapContainerRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center: ATLANTA_CENTER,
          zoom: 12,
          styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        const infoWindow = new google.maps.InfoWindow();

        mapInstanceRef.current = map;
        infoWindowRef.current = infoWindow;
        setIsMapLoaded(true);
      })
      .catch((err: unknown) => {
        console.error('Failed to load Google Maps:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setLoadError(
          errMsg || 'Unable to load Google Maps API. Please verify API key.',
        );
      });

    return () => {
      // Clean up map listeners & markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      demographicCirclesRef.current.forEach((c) => c.setMap(null));
      demographicCirclesRef.current = [];
    };
  }, []);

  // Update map style when dark/light mode toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({
        styles: isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
      });
    }
  }, [isDark]);

  // Filtered recipient list based on search and storage capability
  const filteredRecipients = useMemo(() => {
    let list = recipients;
    if (storageFilter === 'cold') {
      list = list.filter((r) => r.cold_storage && r.cold_storage !== 'none');
    } else if (storageFilter === 'ambient') {
      list = list.filter((r) => !r.cold_storage || r.cold_storage === 'none');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.archetype_label.toLowerCase().includes(q) ||
          r.street.toLowerCase().includes(q) ||
          (r.tract?.neighborhood || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [recipients, storageFilter, searchQuery]);

  // Matched recipient & backups / decoys
  const primaryMatchId = currentMatch?.primary_match?.recipient_id;
  const backupIds = useMemo(() => {
    return new Set(
      (currentMatch?.primary_match ? [currentMatch.primary_match] : []).map(
        (r) => r.recipient_id,
      ),
    );
  }, [currentMatch]);

  // Re-draw Markers, Dispatch Polyline, and Demographic Circles
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    // 1. Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 2. Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // 3. Clear existing demographic circles
    demographicCirclesRef.current.forEach((c) => c.setMap(null));
    demographicCirclesRef.current = [];

    // ---------------------------------------------------------
    // RENDER DEMOGRAPHIC CIRCLES / CATCHMENT ZONES
    // ---------------------------------------------------------
    if (activeDemographicMetric !== 'none') {
      tracts.forEach((t) => {
        if (!t.tract_lat || !t.tract_lon) return;

        let fillCol = '#10b981';
        let strokeCol = '#059669';
        let valStr = '';
        let opacity = 0.22;

        if (activeDemographicMetric === 'no_vehicle_rate') {
          const rate = t.no_vehicle_rate * 100;
          valStr = `${rate.toFixed(1)}% No-Vehicle`;
          if (rate >= 26) {
            fillCol = '#f43f5e'; // High transit need
            strokeCol = '#e11d48';
            opacity = 0.35;
          } else if (rate >= 15) {
            fillCol = '#f59e0b'; // Moderate
            strokeCol = '#d97706';
            opacity = 0.28;
          } else {
            fillCol = '#10b981'; // Low
            strokeCol = '#059669';
            opacity = 0.18;
          }
        } else if (activeDemographicMetric === 'poverty_rate') {
          const rate = t.poverty_rate * 100;
          valStr = `${rate.toFixed(1)}% Poverty`;
          if (rate >= 30) {
            fillCol = '#f43f5e';
            strokeCol = '#e11d48';
            opacity = 0.35;
          } else if (rate >= 18) {
            fillCol = '#f59e0b';
            strokeCol = '#d97706';
            opacity = 0.28;
          } else {
            fillCol = '#10b981';
            strokeCol = '#059669';
            opacity = 0.18;
          }
        } else if (activeDemographicMetric === 'assistance_rate') {
          const rate = t.assistance_rate * 100;
          valStr = `${rate.toFixed(1)}% SNAP/Assistance`;
          if (rate >= 28) {
            fillCol = '#f43f5e';
            strokeCol = '#e11d48';
            opacity = 0.35;
          } else if (rate >= 16) {
            fillCol = '#f59e0b';
            strokeCol = '#d97706';
            opacity = 0.28;
          } else {
            fillCol = '#10b981';
            strokeCol = '#059669';
            opacity = 0.18;
          }
        } else if (activeDemographicMetric === 'median_income') {
          const inc = t.median_income;
          valStr = `$${inc.toLocaleString()} Median Inc`;
          if (inc < 35000 && inc > 0) {
            fillCol = '#f43f5e';
            strokeCol = '#e11d48';
            opacity = 0.35;
          } else if (inc < 55000 && inc > 0) {
            fillCol = '#f59e0b';
            strokeCol = '#d97706';
            opacity = 0.28;
          } else {
            fillCol = '#10b981';
            strokeCol = '#059669';
            opacity = 0.18;
          }
        }

        const circle = new google.maps.Circle({
          strokeColor: strokeCol,
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: fillCol,
          fillOpacity: opacity,
          map,
          center: { lat: t.tract_lat, lng: t.tract_lon },
          radius: 1200 + Math.min((t.total_pop || 3000) / 10, 800),
        });

        circle.addListener('click', (ev: google.maps.MapMouseEvent) => {
          if (!infoWindow || !ev.latLng) return;
          infoWindow.setContent(`
            <div style="font-family: Inter, sans-serif; padding: 6px; font-size: 12px; color: #0f172a; max-width: 240px;">
              <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${t.neighborhood}</div>
              <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">Census Tract ${t.geo_id}</div>
              <div style="background: #f1f5f9; padding: 6px 8px; border-radius: 6px; margin-bottom: 4px;">
                <span style="font-weight: 600;">Indicator:</span> ${valStr}
              </div>
              <div style="font-size: 11px; color: #334155; line-height: 1.4;">
                • No-Vehicle Rate: <strong>${(t.no_vehicle_rate * 100).toFixed(1)}%</strong><br/>
                • Poverty Rate: <strong>${(t.poverty_rate * 100).toFixed(1)}%</strong><br/>
                • Total Population: <strong>${t.total_pop.toLocaleString()}</strong>
              </div>
            </div>
          `);
          infoWindow.setPosition(ev.latLng);
          infoWindow.open(map);
        });

        demographicCirclesRef.current.push(circle);
      });
    }

    // ---------------------------------------------------------
    // RENDER DONOR ORIGIN PIN
    // ---------------------------------------------------------
    const donorLat = selectedPosting?.donor_lat || 33.7719;
    const donorLon = selectedPosting?.donor_lon || -84.3665;
    const donorPos = { lat: donorLat, lng: donorLon };

    if (selectedPosting) {
      const donorMarker = new google.maps.Marker({
        position: donorPos,
        map,
        title: `Donor Dock: ${selectedPosting.donor_name}`,
        zIndex: 900,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#4f46e5', // Indigo
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });

      donorMarker.addListener('click', () => {
        if (!infoWindow) return;
        infoWindow.setContent(`
          <div style="font-family: Inter, sans-serif; padding: 6px; font-size: 12px; color: #0f172a; max-width: 250px;">
            <div style="display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">
              SURPLUS DONOR DOCK
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${selectedPosting.donor_name}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              <strong>Offer #${selectedPosting.posting_id}:</strong> ${selectedPosting.foodkeeper_product}
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${selectedPosting.pallets_estimated} pallets · <span style="color: #059669; font-weight: 600;">${selectedPosting.hours_remaining}h left on clock</span>
            </div>
          </div>
        `);
        infoWindow.open(map, donorMarker);
      });

      markersRef.current.push(donorMarker);
    }

    // ---------------------------------------------------------
    // RENDER RECIPIENT PINS
    // ---------------------------------------------------------
    filteredRecipients.forEach((rec) => {
      if (!rec.latitude || !rec.longitude) return;

      const isPrimary = rec.recipient_id === primaryMatchId;
      const isBackup = backupIds.has(rec.recipient_id);
      const isDecoy = rec.planted_role === 'near_miss_decoy';

      let markerColor = '#64748b'; // default slate
      let markerScale = 5;
      let strokeColor = '#ffffff';
      let zIndex = 100;

      if (isPrimary) {
        markerColor = '#10b981'; // Emerald
        markerScale = 12;
        strokeColor = '#ffffff';
        zIndex = 1000;
      } else if (isBackup) {
        markerColor = '#0ea5e9'; // Cyan/sky
        markerScale = 8;
        strokeColor = '#ffffff';
        zIndex = 500;
      } else if (isDecoy) {
        markerColor = '#f43f5e'; // Rose
        markerScale = 7;
        strokeColor = '#ffffff';
        zIndex = 400;
      }

      const marker = new google.maps.Marker({
        position: { lat: rec.latitude, lng: rec.longitude },
        map,
        title: rec.name,
        zIndex,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: markerScale,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor,
          strokeWeight: isPrimary ? 3 : 1.5,
        },
      });

      marker.addListener('click', () => {
        if (!infoWindow) return;

        const isCold = rec.cold_storage && rec.cold_storage !== 'none';
        const tractInfo = rec.tract;

        infoWindow.setContent(`
          <div style="font-family: Inter, sans-serif; padding: 6px; font-size: 12px; color: #0f172a; max-width: 270px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${
                isPrimary
                  ? 'background: #d1fae5; color: #065f46;'
                  : isBackup
                  ? 'background: #e0f2fe; color: #0369a1;'
                  : 'background: #f1f5f9; color: #475569;'
              }">
                ${isPrimary ? '★ MATCHED RECIPIENT' : isBackup ? 'PRE-SCREENED BACKUP' : rec.archetype_label}
              </span>
              <span style="font-size: 10px; font-family: monospace; color: #64748b;">
                ${rec.cold_storage} · ${rec.max_pallets} plt
              </span>
            </div>

            <div style="font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.3;">${rec.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${rec.street}, ${rec.city} (${tractInfo?.neighborhood || 'Atlanta Metro'})
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin: 8px 0; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">No-Vehicle Households:</span>
                <strong style="color: #047857;">${((tractInfo?.no_vehicle_rate || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Poverty Rate:</span>
                <strong>${((tractInfo?.poverty_rate || 0) * 100).toFixed(1)}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Weekly Reach:</span>
                <strong>${rec.weekly_households || 0} families</strong>
              </div>
            </div>

            ${
              !isCold && selectedPosting?.storage_state === 'refrigerated'
                ? `<div style="background: #fee2e2; color: #991b1b; font-size: 10px; padding: 4px 6px; border-radius: 4px; margin-bottom: 8px;">
                    ⚠️ Ambient only — Incompatible with cold-chain rescue
                   </div>`
                : ''
            }

            ${
              !isPrimary && onOpenUpdateModal
                ? `<button id="assign-btn-${rec.recipient_id}" style="width: 100%; background: #059669; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer;">
                    Assign to Offer #${selectedPosting?.posting_id || 1} via Primary Agent
                   </button>`
                : ''
            }
          </div>
        `);

        infoWindow.open(map, marker);

        // Add event listener to the button inside InfoWindow
        if (!isPrimary && onOpenUpdateModal) {
          google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            const btn = document.getElementById(`assign-btn-${rec.recipient_id}`);
            if (btn) {
              btn.onclick = () => {
                onOpenUpdateModal(rec.recipient_id);
                infoWindow.close();
              };
            }
          });
        }
      });

      markersRef.current.push(marker);
    });

    // ---------------------------------------------------------
    // RENDER GEODESIC DISPATCH ROUTE (Donor -> Matched Recipient)
    // ---------------------------------------------------------
    const matchedRecipient = currentMatch?.primary_match;
    if (selectedPosting && matchedRecipient && matchedRecipient.latitude) {
      const recipientPos = {
        lat: matchedRecipient.latitude,
        lng: matchedRecipient.longitude,
      };

      const polyline = new google.maps.Polyline({
        path: [donorPos, recipientPos],
        geodesic: true,
        strokeColor: '#10b981', // Emerald dispatch route
        strokeOpacity: 0.9,
        strokeWeight: 3.5,
        map,
      });

      polylineRef.current = polyline;

      // Fit map bounds to encompass both Donor and Destination
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(donorPos);
      bounds.extend(recipientPos);
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [
    isMapLoaded,
    selectedPosting,
    currentMatch,
    filteredRecipients,
    tracts,
    activeDemographicMetric,
    primaryMatchId,
    backupIds,
    onOpenUpdateModal,
  ]);

  // Handler: Focus specifically on the active match
  const handleFocusActiveMatch = () => {
    if (!mapInstanceRef.current || !selectedPosting || !currentMatch?.primary_match) {
      return;
    }
    const donorLat = selectedPosting.donor_lat || 33.7719;
    const donorLon = selectedPosting.donor_lon || -84.3665;
    const recLat = currentMatch.primary_match.latitude;
    const recLon = currentMatch.primary_match.longitude;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: donorLat, lng: donorLon });
    bounds.extend({ lat: recLat, lng: recLon });
    mapInstanceRef.current.fitBounds(bounds, {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    });
  };

  // Handler: Fit entire Atlanta Metro
  const handleFitAllAtlanta = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setCenter(ATLANTA_CENTER);
    mapInstanceRef.current.setZoom(12);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-white dark:bg-[#0B0F17] rounded-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden shadow-md ring-1 ring-slate-900/5 dark:ring-white/10">
      {/* Top Map Toolbar */}
      <div className="px-5 py-3 border-b-2 border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-600/20 dark:border-emerald-500/30">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                Spatial Dispatch &amp; Neighborhood Equity Map
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                Google Maps API
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Correlating rescue routes against Census ACS transit and poverty catchment zones across Atlanta.
            </p>
          </div>
        </div>

        {/* Filter & Metric Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Demographic Layer Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={activeDemographicMetric}
              onChange={(e) =>
                setActiveDemographicMetric(e.target.value as DemographicMetric)
              }
              className="text-xs bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none pr-2 font-medium cursor-pointer"
            >
              <option value="no_vehicle_rate">
                🚗 No-Vehicle % (Equity Metric)
              </option>
              <option value="poverty_rate">📉 Poverty Rate %</option>
              <option value="assistance_rate">🏛️ SNAP / Public Assistance %</option>
              <option value="median_income">💵 Median Household Income</option>
              <option value="none">🚫 Pins Only (No Overlays)</option>
            </select>
          </div>

          {/* Storage Capability Filter */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 border-2 border-slate-300 dark:border-slate-700 shadow-2xs text-xs">
            <button
              onClick={() => setStorageFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                storageFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Orgs ({recipients.length})
            </button>
            <button
              onClick={() => setStorageFilter('cold')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                storageFilter === 'cold'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200/80 dark:border-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Snowflake className="w-3 h-3" />
              Cold Chain
            </button>
            <button
              onClick={() => setStorageFilter('ambient')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                storageFilter === 'ambient'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200/80 dark:border-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Ambient
            </button>
          </div>

          {/* Quick Focus Controls */}
          <button
            onClick={handleFocusActiveMatch}
            title="Focus on Active Dispatch Route"
            className="p-1.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-2xs"
          >
            <Focus className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitAllAtlanta}
            title="Fit All Atlanta Metro"
            className="p-1.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-2xs"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Map View Area */}
      <div className="relative flex-1 w-full min-h-[520px]">
        {/* Google Maps Container */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Fallback Display if API error or key missing */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md text-white text-center z-30">
            <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
            <h3 className="text-base font-display font-bold">
              Google Maps API Configuration
            </h3>
            <p className="text-xs text-slate-300 max-w-md mt-1 mb-4 leading-relaxed">
              {loadError}
            </p>
            <div className="p-3 rounded-xl bg-slate-800/80 border-2 border-slate-700 text-xs text-slate-400 font-mono text-left max-w-md mb-4">
              Ensure <code>VITE_GOOGLE_MAPS_API_KEY</code> is set in <code>frontend/.env</code> with Maps JavaScript API enabled.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Floating Search Bar (Top Left) */}
        <div className="absolute top-3 left-3 z-20 w-72 max-w-[calc(100vw-3rem)]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient or neighborhood..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-2 border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-xl ring-1 ring-slate-900/10 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Floating Map Legend (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-3 shadow-xl ring-1 ring-slate-900/10 max-w-xs text-xs space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-200/80 dark:border-slate-800">
            <span className="font-semibold text-[11px] text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Dispatch &amp; Equity Legend
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {filteredRecipients.length} visible
            </span>
          </div>

          {/* Marker Types */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900 shrink-0" />
              <span>Donor Dock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shrink-0" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Matched Recipient
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <span>Viable Backup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>Blocked Decoy</span>
            </div>
          </div>

          {/* Demographic Gradient Bar */}
          {activeDemographicMetric !== 'none' && (
            <div className="pt-1 border-t-2 border-slate-200/80 dark:border-slate-800">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                <span>
                  {activeDemographicMetric === 'no_vehicle_rate'
                    ? 'No-Vehicle Transit Need'
                    : activeDemographicMetric === 'poverty_rate'
                    ? 'Neighborhood Poverty'
                    : activeDemographicMetric === 'assistance_rate'
                    ? 'Public Assistance / SNAP'
                    : 'Median Household Income'}
                </span>
                <span className="font-mono text-[9px]">Census ACS 5-Yr</span>
              </div>
              <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 w-full" />
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                <span>Low Equity Need</span>
                <span>Critical Need</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Active Match Summary Card (Top Right) */}
        {selectedPosting && currentMatch?.primary_match && (
          <div className="absolute top-3 right-3 z-20 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-3.5 shadow-xl ring-1 ring-slate-900/10 max-w-sm hidden sm:block">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border-2 border-emerald-300/80 dark:border-emerald-800">
                Active Rescue Route
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                Offer #{selectedPosting.posting_id}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[10px] uppercase block">
                    Origin Donor
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedPosting.donor_name}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[10px] uppercase block">
                    Destination Pantry
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {currentMatch.primary_match.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t-2 border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                {selectedPosting.foodkeeper_product} ({selectedPosting.pallets_estimated} plt)
              </span>
              <button
                onClick={handleFocusActiveMatch}
                className="text-emerald-600 hover:text-emerald-500 font-semibold flex items-center gap-1 transition-colors"
              >
                <Focus className="w-3 h-3" />
                Center Route
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
