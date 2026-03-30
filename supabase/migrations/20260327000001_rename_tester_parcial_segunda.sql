-- Migration 1 of 2: Add new enum value + relax constraints
-- PostgreSQL requires ADD VALUE in a separate transaction before usage

-- Add SALIDA_PARCIAL to tipo_movimiento enum
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'SALIDA_PARCIAL';
