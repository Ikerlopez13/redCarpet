import mapboxgl from 'mapbox-gl';
import type { LngLatLike } from 'mapbox-gl';

/**
 * Singleton MapProvider to initialize and manage a Mapbox GL JS map instance.
 * It abstracts map creation, style switching (normal/satellite), and POI layer handling.
 */
class MapProvider {
  private static instance: MapProvider;
  private map?: mapboxgl.Map;
  private containerId: string = '';

  private constructor() {
    // Private to enforce singleton pattern.
    mapboxgl.accessToken = process.env.VITE_MAPBOX_TOKEN || '';
  }

  static getInstance(): MapProvider {
    if (!MapProvider.instance) {
      MapProvider.instance = new MapProvider();
    }
    return MapProvider.instance;
  }

  /**
   * Initialize the map in the specified container.
   * @param containerId DOM element id where the map will be rendered.
   * @param center Initial center coordinates.
   * @param zoom Initial zoom level.
   */
  initMap(containerId: string, center: LngLatLike = [0, 0], zoom: number = 2) {
    this.containerId = containerId;
    if (this.map) {
      this.map.remove();
    }
    this.map = new mapboxgl.Map({
      container: containerId,
      style: 'mapbox://styles/mapbox/streets-v12', // normal mode
      center,
      zoom,
    });
    // Add navigation control (zoom buttons)
    this.map.addControl(new mapboxgl.NavigationControl());
  }

  /** Switch the map style between normal and satellite. */
  setStyle(style: 'normal' | 'satellite') {
    if (!this.map) return;
    const styleUrl =
      style === 'normal'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12';
    this.map.setStyle(styleUrl);
  }

  /** Add a GeoJSON source and layer for POIs. */
  addPoiLayer(sourceId: string, data: GeoJSON.FeatureCollection, layerId: string) {
    if (!this.map) return;
    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, { type: 'geojson', data });
    }
    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#FF4500',
          'circle-opacity': 0.8,
        },
      });
    }
  }

  /** Get the underlying map instance for direct interactions. */
  getMap(): mapboxgl.Map | undefined {
    return this.map;
  }
}

export default MapProvider.getInstance();
