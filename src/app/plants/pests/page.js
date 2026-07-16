'use client'

import {
    PLANT_PEST_RESOURCE_MARKER,
    PLANT_PEST_RESOURCE_TYPES,
    ResourceTrackerPage,
    isPlantPestResource,
    stripPlantPestMarker,
} from '@/app/ResourceTrackerPage'

const pestStartingForm = {
    name: '',
    tracker_type: 'pest_trap',
    depletion_days: '30',
    warning_threshold_percent: '25',
    color: '#86efac',
    last_reset_at: '',
    notes: '',
}

function markAsPlantPest(payload) {
    const notes = stripPlantPestMarker(payload.notes || '')
    return {
        ...payload,
        tracker_type: payload.tracker_type || 'custom',
        notes: notes ? `${notes}\n${PLANT_PEST_RESOURCE_MARKER}` : PLANT_PEST_RESOURCE_MARKER,
    }
}

export default function PlantPestsPage() {
    return (
        <ResourceTrackerPage
            title="Pests"
            eyebrow="Plants"
            eyebrowHref="/plants"
            subNav={null}
            itemFilter={isPlantPestResource}
            payloadTransform={markAsPlantPest}
            notesForDisplay={stripPlantPestMarker}
            activeLabel="tracked"
            createTitle="New Pest Resource"
            editTitle="Edit Pest Resource"
            emptyText="No pest resources are being tracked yet."
            startingForm={pestStartingForm}
            trackerTypes={PLANT_PEST_RESOURCE_TYPES}
        />
    )
}
