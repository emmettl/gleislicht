import { MobilePicker } from '@motionstudies/web/components/MobilePicker'
import { TransportIcon } from '../TransportIcon.tsx'
import type { MapCameraAction } from '@motionstudies/three/NationalNetworkScene'
import type { TrainLabelMode } from '@motionstudies/three/train-labels'
import type { ServiceCategory } from '@motionstudies/core/domain/network'
import type { RoadTopologyRoad } from '@motionstudies/core/domain/road'
import type { UiText } from '../locales/en.ts'

interface Props {
  hasSelection: boolean
  moveMapCamera: (action: MapCameraAction) => void
  isCogwheel: boolean
  roadCategorySelected: boolean
  airCategorySelected: boolean
  selectedCategory?: ServiceCategory
  isNational: boolean
  railVisible: boolean
  visibleServiceCategories: readonly { id: ServiceCategory }[]
  categoryLabel: (category: ServiceCategory) => string
  serviceColors: Readonly<Record<ServiceCategory, string>>
  isMountainStudy: boolean
  cogwheelLabel: string
  airEnabled: boolean
  roadEnabled: boolean
  trainLabelMode: TrainLabelMode
  selectedRoadId?: string
  roads?: readonly RoadTopologyRoad[]
  onCategoryChange: (category: string) => void
  onLabelChange: (mode: TrainLabelMode) => void
  onRoadChange: (road: string) => void
  text: UiText
}

export default function MobileMapTools({ hasSelection, moveMapCamera, isCogwheel, roadCategorySelected, airCategorySelected, selectedCategory, isNational, railVisible, visibleServiceCategories, categoryLabel, serviceColors, isMountainStudy, cogwheelLabel, airEnabled, roadEnabled, trainLabelMode, selectedRoadId, roads, onCategoryChange, onLabelChange, onRoadChange, text }: Props) {
  return (
            <div>
              {!hasSelection && (
                <div className="mobile-zoom-row">
                  <button
                    type="button"
                    aria-label={text.zoomIn}
                    onClick={() => moveMapCamera('zoom-in')}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label={text.zoomOut}
                    onClick={() => moveMapCamera('zoom-out')}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={text.resetMap}
                    onClick={() => moveMapCamera('reset')}
                  >
                    ↺
                  </button>
                </div>
              )}
              <div className="mobile-tool-field">
                <span>{text.services}</span>
                <MobilePicker
                  ariaLabel={text.filterServices}
                  value={
                    isCogwheel ? 'cogwheel' : roadCategorySelected
                      ? 'road'
                      : airCategorySelected
                        ? 'air'
                        : (selectedCategory ?? '')
                  }
                  options={[
                    { value: '', label: text.allServices },
                    ...(isNational ? [{ value: 'cogwheel', label: <span className="transport-option"><TransportIcon mode="cogwheel" color="#fff3a6" />{cogwheelLabel}</span> }] : []),
                    ...(!railVisible ? [] : visibleServiceCategories).map((category) => ({
                      value: category.id,
                      label: <span className="transport-option"><TransportIcon mode={isMountainStudy && category.id === 'other' ? 'cogwheel' : category.id} color={serviceColors[category.id]} />{categoryLabel(category.id)}</span>,
                    })),
                    ...(isNational && airEnabled
                      ? [{ value: 'air', label: <span className="transport-option"><TransportIcon mode="air" color="#ff5edb" />{text.luftraum}</span> }]
                      : []),
                    ...(isNational && roadEnabled
                      ? [{ value: 'road', label: <span className="transport-option"><TransportIcon mode="road" color="#ffb36b" />{text.auto}</span> }]
                      : []),
                  ]}
                  onChange={onCategoryChange}
                />
              </div>
              <div className="mobile-tool-field">
                <span>{text.labels}</span>
                <MobilePicker
                  ariaLabel={text.vehicleLabels}
                  value={trainLabelMode}
                  options={[
                    { value: 'auto', label: text.labelModes.auto },
                    { value: 'on', label: text.labelModes.on },
                    { value: 'off', label: text.labelModes.off },
                  ]}
                  onChange={(labelMode) =>
                    onLabelChange(labelMode as TrainLabelMode)
                  }
                />
              </div>
              {roads && (
                <div className="mobile-tool-field">
                  <span>{text.roadCorridors}</span>
                  <MobilePicker
                    ariaLabel={text.selectRoadCorridor}
                    value={selectedRoadId ?? ''}
                    options={[
                      { value: '', label: text.allMotorways },
                      ...roads.map((road) => ({
                        value: road.id,
                        label: road.label,
                        detail:
                          road.description ?? text.roadSections(road.sectionCount),
                      })),
                    ]}
                    onChange={onRoadChange}
                  />
                </div>
              )}
            </div>
  )
}
