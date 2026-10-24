export interface BookingNotificationJobData {
  bookingId: string;
  userId: string;
  userEmail: string;
  userName: string;
  resourceName: string;
  resourceLocation?: string | null;
  startTime: string;
  endTime: string;
  title?: string | null;
  type: 'CONFIRMED' | 'CANCELLED';
}
