export function randomNumber(max: number): number
export function randomNumber(min: number, max: number): number
export function randomNumber(min: number, max?: number): number {
  if (!max) [min, max] = [0, min]
  if (min > max) [min, max] = [max, min]
  return Math.floor(min + Math.random() * (max - min))
}
