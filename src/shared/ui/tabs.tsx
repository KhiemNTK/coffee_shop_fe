import React, { createContext, useContext, useId } from 'react'
import { cn } from './utils'

interface TabsContextValue {
  id: string
  value: string
  onValueChange: (val: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (val: string) => void
  children: React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <TabsContext.Provider value={{ id, value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  onKeyDown,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-[#f0f4f1] p-1 text-[#5c7064]',
        className,
      )}
      role="tablist"
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
        const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
        if (current < 0 || !tabs.length) return
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        event.preventDefault()
        tabs[index]?.focus()
        tabs[index]?.click()
      }}
      {...props}
    />
  )
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')
  const isSelected = context.value === value

  return (
    <button
      type="button"
      role="tab"
      id={`${context.id}-tab-${value}`}
      aria-controls={`${context.id}-panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      aria-selected={isSelected}
      onClick={() => context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174f3f] cursor-pointer disabled:pointer-events-none disabled:opacity-50 select-none',
        isSelected
          ? 'bg-white text-[#174f3f] font-semibold shadow-xs'
          : 'hover:text-[#202d29] hover:bg-white/50 text-[#5c7064]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  return (
    <div
      role="tabpanel"
      id={`${context.id}-panel-${value}`}
      aria-labelledby={`${context.id}-tab-${value}`}
      hidden={context.value !== value}
      tabIndex={0}
      className={cn('mt-3 ring-offset-white focus-visible:outline-none', className)}
      {...props}
    >
      {context.value === value ? children : null}
    </div>
  )
}
