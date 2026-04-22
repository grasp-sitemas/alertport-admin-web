'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Thin wrapper around @radix-ui/react-accordion. The shape mirrors the
 * shadcn API (Root / Item / Trigger / Content) so callers can opt into
 * project-specific styling without losing Radix's accessibility wins
 * (keyboard nav, ARIA wiring, controlled state, focus management).
 *
 * The Trigger renders its own ChevronDown that rotates 180° via the
 * data-state attribute Radix sets on the underlying button. Content
 * uses the accordion-down/up keyframes declared in globals.css to get
 * a smooth height transition driven by --radix-accordion-content-height.
 */

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn('', className)} {...props} />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none',
        'text-text-secondary hover:bg-white/[0.04] hover:text-white',
        'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-0',
        '[&[data-state=open]>svg.accordion-chevron]:rotate-180',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className="accordion-chevron h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-hover:text-white"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm',
      'data-[state=open]:animate-[accordion-down_200ms_cubic-bezier(0.4,0,0.2,1)]',
      'data-[state=closed]:animate-[accordion-up_200ms_cubic-bezier(0.4,0,0.2,1)]',
    )}
    {...props}
  >
    <div className={cn('pt-1', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
