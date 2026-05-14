import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

export const useDragPointerSensors = () => {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )
}