'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface DragState {
  draggingIds: number[]
  setDragging: (ids: number[]) => void
  clearDragging: () => void
}

const DragContext = createContext<DragState>({
  draggingIds: [],
  setDragging: () => {},
  clearDragging: () => {},
})

export function DragProvider({ children }: { children: ReactNode }) {
  const [draggingIds, setDraggingIds] = useState<number[]>([])
  return (
    <DragContext.Provider value={{
      draggingIds,
      setDragging: setDraggingIds,
      clearDragging: () => setDraggingIds([]),
    }}>
      {children}
    </DragContext.Provider>
  )
}

export function useDragStore() {
  return useContext(DragContext)
}
