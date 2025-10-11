import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date in Indian format (dd/mm/yyyy)
export function formatDateForIndia(date: Date | string | number | undefined | null): string {
  // Handle null/undefined inputs
  if (!date) {
    return '';
  }

  let dateObj: Date;

  try {
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'number') {
      // Handle Unix timestamp (from Convex _creationTime)
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }

    // Handle invalid dates
    if (!dateObj || isNaN(dateObj.getTime())) {
      return '';
    }
  } catch (error) {
    console.error('Error in formatDateForIndia:', error);
    return '';
  }

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
}