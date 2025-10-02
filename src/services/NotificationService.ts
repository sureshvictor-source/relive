import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Commitment } from './CommitmentTrackingService';

export interface NotificationSchedule {
  id: string;
  type: 'commitment_reminder' | 'follow_up' | 'relationship_check' | 'overdue_alert';
  title: string;
  message: string;
  scheduledTime: Date;
  isRepeating: boolean;
  repeatInterval?: 'daily' | 'weekly' | 'monthly';
  data?: Record<string, any>;
  isActive: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  commitmentReminders: boolean;
  followUpSuggestions: boolean;
  relationshipChecks: boolean;
  overdueAlerts: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  reminderTimings: {
    commitmentReminder: number; // days before due date
    followUpReminder: number;   // days after conversation
    relationshipCheck: number;  // days since last conversation
  };
}

class NotificationService {
  private scheduledNotifications: Map<string, NotificationSchedule> = new Map();
  private settings: NotificationSettings;
  private isInitialized = false;
  private pushNotificationAvailable = false;

  constructor() {
    this.settings = this.getDefaultSettings();
    this.initializeService();
  }

  /**
   * Get default notification settings
   */
  private getDefaultSettings(): NotificationSettings {
    return {
      enabled: true,
      commitmentReminders: true,
      followUpSuggestions: true,
      relationshipChecks: true,
      overdueAlerts: true,
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
      },
      reminderTimings: {
        commitmentReminder: 1, // 1 day before
        followUpReminder: 3,   // 3 days after
        relationshipCheck: 14, // 2 weeks since last conversation
      },
    };
  }

  /**
   * Initialize notification service
   */
  private async initializeService(): Promise<void> {
    try {
      // Check if PushNotification is available
      this.checkPushNotificationAvailability();

      // Load settings
      await this.loadSettings();

      // Load scheduled notifications
      await this.loadScheduledNotifications();

      // Request permissions
      await this.requestPermissions();

      // Configure push notifications if available
      if (this.pushNotificationAvailable) {
        this.configurePushNotifications();
      } else {
        console.warn('Push notifications not available - notification functionality will be limited');
      }

      this.isInitialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if push notification libraries are available
   */
  private checkPushNotificationAvailability(): void {
    try {
      if (!PushNotification || typeof PushNotification.configure !== 'function') {
        console.warn('PushNotification module not available');
        this.pushNotificationAvailable = false;
        return;
      }

      if (Platform.OS === 'ios' && (!PushNotificationIOS || typeof PushNotificationIOS.requestPermissions !== 'function')) {
        console.warn('PushNotificationIOS module not available');
        this.pushNotificationAvailable = false;
        return;
      }

      this.pushNotificationAvailable = true;
    } catch (error) {
      console.error('Error checking push notification availability:', error);
      this.pushNotificationAvailable = false;
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<boolean> {
    try {
      if (!this.pushNotificationAvailable) {
        console.warn('Push notifications not available, skipping permission request');
        return false;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return new Promise((resolve) => {
          PushNotificationIOS.requestPermissions({
            alert: true,
            badge: true,
            sound: true,
          }).then((permissions) => {
            resolve(permissions.alert || false);
          }).catch((error) => {
            console.error('iOS permission request failed:', error);
            resolve(false);
          });
        });
      }
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Configure push notification handlers
   */
  private configurePushNotifications(): void {
    if (!this.pushNotificationAvailable || !PushNotification) {
      console.warn('Cannot configure push notifications - module not available');
      return;
    }

    try {
      PushNotification.configure({
      onRegister: (token) => {
        console.log('FCM Token:', token);
      },

      onNotification: (notification) => {
        console.log('Notification received:', notification);

        if (notification.userInteraction) {
          // User tapped on notification
          this.handleNotificationTap(notification);
        }

        // Required on iOS only
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'relive-default',
          channelName: 'Relive Notifications',
          channelDescription: 'Default notifications for Relive app',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Notification channel created: ${created}`)
      );
    }
    } catch (error) {
      console.error('Failed to configure push notifications:', error);
      this.pushNotificationAvailable = false;
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: any): void {
    const { type, data } = notification.data || {};

    switch (type) {
      case 'commitment_reminder':
        // Navigate to commitment details
        console.log('Navigate to commitment:', data?.commitmentId);
        break;
      case 'follow_up':
        // Navigate to contact conversation
        console.log('Navigate to contact:', data?.contactId);
        break;
      case 'relationship_check':
        // Navigate to relationship dashboard
        console.log('Navigate to relationship dashboard');
        break;
      case 'overdue_alert':
        // Navigate to overdue commitments
        console.log('Navigate to overdue commitments');
        break;
    }
  }

  /**
   * Schedule commitment reminder
   */
  async scheduleCommitmentReminder(
    commitmentId: string,
    commitmentText: string,
    dueDate: Date
  ): Promise<boolean> {
    if (!this.settings.enabled || !this.settings.commitmentReminders) {
      return false;
    }

    try {
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - this.settings.reminderTimings.commitmentReminder);

      // Don't schedule if reminder time is in the past
      if (reminderDate <= new Date()) {
        return false;
      }

      const notificationId = `commitment_${commitmentId}`;

      const schedule: NotificationSchedule = {
        id: notificationId,
        type: 'commitment_reminder',
        title: 'Commitment Reminder',
        message: `Don't forget: ${commitmentText}`,
        scheduledTime: reminderDate,
        isRepeating: false,
        data: { commitmentId },
        isActive: true,
      };

      // Schedule the notification
      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.localNotificationSchedule({
          id: notificationId,
          title: schedule.title,
          message: schedule.message,
          date: reminderDate,
          channelId: 'relive-default',
          userInfo: { type: 'commitment_reminder', commitmentId },
        });
      } else {
        console.warn('Cannot schedule notification - push notification not available');
      }

      // Store schedule
      this.scheduledNotifications.set(notificationId, schedule);
      await this.saveScheduledNotifications();

      console.log(`Scheduled commitment reminder for ${reminderDate.toLocaleString()}`);
      return true;
    } catch (error) {
      console.error('Failed to schedule commitment reminder:', error);
      return false;
    }
  }

  /**
   * Schedule follow-up reminder
   */
  async scheduleFollowUpReminder(
    contactId: string,
    contactName: string,
    conversationDate: Date
  ): Promise<boolean> {
    if (!this.settings.enabled || !this.settings.followUpSuggestions) {
      return false;
    }

    try {
      const reminderDate = new Date(conversationDate);
      reminderDate.setDate(reminderDate.getDate() + this.settings.reminderTimings.followUpReminder);

      const notificationId = `followup_${contactId}_${conversationDate.getTime()}`;

      const schedule: NotificationSchedule = {
        id: notificationId,
        type: 'follow_up',
        title: 'Follow-up Suggestion',
        message: `Consider reaching out to ${contactName} - it's been a few days since your last conversation`,
        scheduledTime: reminderDate,
        isRepeating: false,
        data: { contactId, contactName },
        isActive: true,
      };

      // Adjust for quiet hours
      const adjustedTime = this.adjustForQuietHours(reminderDate);

      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.localNotificationSchedule({
          id: notificationId,
          title: schedule.title,
          message: schedule.message,
          date: adjustedTime,
          channelId: 'relive-default',
          userInfo: { type: 'follow_up', contactId },
        });
      } else {
        console.warn('Cannot schedule follow-up notification - push notification not available');
      }

      this.scheduledNotifications.set(notificationId, schedule);
      await this.saveScheduledNotifications();

      console.log(`Scheduled follow-up reminder for ${contactName}`);
      return true;
    } catch (error) {
      console.error('Failed to schedule follow-up reminder:', error);
      return false;
    }
  }

  /**
   * Schedule relationship check reminder
   */
  async scheduleRelationshipCheckReminder(
    contactId: string,
    contactName: string,
    lastConversationDate: Date
  ): Promise<boolean> {
    if (!this.settings.enabled || !this.settings.relationshipChecks) {
      return false;
    }

    try {
      const reminderDate = new Date(lastConversationDate);
      reminderDate.setDate(reminderDate.getDate() + this.settings.reminderTimings.relationshipCheck);

      const notificationId = `relationship_${contactId}`;

      const schedule: NotificationSchedule = {
        id: notificationId,
        type: 'relationship_check',
        title: 'Relationship Check-in',
        message: `It's been a while since you talked with ${contactName}. Consider reaching out!`,
        scheduledTime: reminderDate,
        isRepeating: false,
        data: { contactId, contactName },
        isActive: true,
      };

      const adjustedTime = this.adjustForQuietHours(reminderDate);

      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.localNotificationSchedule({
          id: notificationId,
          title: schedule.title,
          message: schedule.message,
          date: adjustedTime,
          channelId: 'relive-default',
          userInfo: { type: 'relationship_check', contactId },
        });
      } else {
        console.warn('Cannot schedule relationship check notification - push notification not available');
      }

      this.scheduledNotifications.set(notificationId, schedule);
      await this.saveScheduledNotifications();

      console.log(`Scheduled relationship check for ${contactName}`);
      return true;
    } catch (error) {
      console.error('Failed to schedule relationship check:', error);
      return false;
    }
  }

  /**
   * Send overdue commitments notification
   */
  async sendOverdueCommitmentsNotification(commitments: Commitment[]): Promise<boolean> {
    if (!this.settings.enabled || !this.settings.overdueAlerts) {
      return false;
    }

    try {
      const count = commitments.length;
      const title = count === 1 ? 'Overdue Commitment' : `${count} Overdue Commitments`;
      const message = count === 1
        ? `You have an overdue commitment: ${commitments[0].text}`
        : `You have ${count} overdue commitments that need attention`;

      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.localNotification({
          id: `overdue_${Date.now()}`,
          title,
          message,
          channelId: 'relive-default',
          userInfo: { type: 'overdue_alert', commitmentIds: commitments.map(c => c.id) },
        });
      } else {
        console.warn('Cannot send overdue notification - push notification not available');
      }

      console.log(`Sent overdue commitments notification for ${count} items`);
      return true;
    } catch (error) {
      console.error('Failed to send overdue commitments notification:', error);
      return false;
    }
  }

  /**
   * Cancel commitment reminder
   */
  async cancelCommitmentReminder(commitmentId: string): Promise<boolean> {
    try {
      const notificationId = `commitment_${commitmentId}`;

      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.cancelLocalNotification(notificationId);
      }

      this.scheduledNotifications.delete(notificationId);
      await this.saveScheduledNotifications();

      console.log(`Cancelled commitment reminder for ${commitmentId}`);
      return true;
    } catch (error) {
      console.error('Failed to cancel commitment reminder:', error);
      return false;
    }
  }

  /**
   * Cancel all notifications for a contact
   */
  async cancelContactNotifications(contactId: string): Promise<boolean> {
    try {
      const toCancel = Array.from(this.scheduledNotifications.values())
        .filter(schedule => schedule.data?.contactId === contactId);

      for (const schedule of toCancel) {
        if (this.pushNotificationAvailable && PushNotification) {
          PushNotification.cancelLocalNotification(schedule.id);
        }
        this.scheduledNotifications.delete(schedule.id);
      }

      await this.saveScheduledNotifications();

      console.log(`Cancelled ${toCancel.length} notifications for contact ${contactId}`);
      return true;
    } catch (error) {
      console.error('Failed to cancel contact notifications:', error);
      return false;
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<boolean> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();

      // If notifications are disabled, cancel all scheduled notifications
      if (!this.settings.enabled) {
        await this.cancelAllNotifications();
      }

      console.log('Notification settings updated');
      return true;
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      return false;
    }
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Get scheduled notifications
   */
  getScheduledNotifications(): NotificationSchedule[] {
    return Array.from(this.scheduledNotifications.values())
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      if (this.pushNotificationAvailable && PushNotification) {
        PushNotification.cancelAllLocalNotifications();
      }
      this.scheduledNotifications.clear();
      await this.saveScheduledNotifications();
      console.log('Cancelled all notifications');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Adjust notification time for quiet hours
   */
  private adjustForQuietHours(date: Date): Date {
    if (!this.settings.quietHours.enabled) {
      return date;
    }

    const time = date.getHours() * 100 + date.getMinutes();
    const startTime = this.parseTime(this.settings.quietHours.startTime);
    const endTime = this.parseTime(this.settings.quietHours.endTime);

    // Check if notification falls within quiet hours
    let isQuietHour = false;
    if (startTime > endTime) {
      // Quiet hours span midnight (e.g., 22:00 to 08:00)
      isQuietHour = time >= startTime || time <= endTime;
    } else {
      // Quiet hours within same day
      isQuietHour = time >= startTime && time <= endTime;
    }

    if (isQuietHour) {
      // Move notification to end of quiet hours
      const adjustedDate = new Date(date);
      const [endHour, endMinute] = this.settings.quietHours.endTime.split(':').map(Number);
      adjustedDate.setHours(endHour, endMinute, 0, 0);

      // If end time is the next day, adjust accordingly
      if (startTime > endTime && time >= startTime) {
        adjustedDate.setDate(adjustedDate.getDate() + 1);
      }

      return adjustedDate;
    }

    return date;
  }

  /**
   * Parse time string to numeric format (HHMM)
   */
  private parseTime(timeString: string): number {
    const [hour, minute] = timeString.split(':').map(Number);
    return hour * 100 + minute;
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Load scheduled notifications from storage
   */
  private async loadScheduledNotifications(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('scheduled_notifications');
      if (stored) {
        const notifications: NotificationSchedule[] = JSON.parse(stored);
        notifications.forEach(notification => {
          notification.scheduledTime = new Date(notification.scheduledTime);
          this.scheduledNotifications.set(notification.id, notification);
        });
      }
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error);
    }
  }

  /**
   * Save scheduled notifications to storage
   */
  private async saveScheduledNotifications(): Promise<void> {
    try {
      const notifications = Array.from(this.scheduledNotifications.values());
      await AsyncStorage.setItem('scheduled_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save scheduled notifications:', error);
    }
  }

  /**
   * Initialize service if not already done
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeService();
    }
  }

  /**
   * Check if push notifications are available
   */
  isPushNotificationAvailable(): boolean {
    return this.pushNotificationAvailable;
  }

  /**
   * Cleanup service
   */
  async cleanup(): Promise<void> {
    await this.cancelAllNotifications();
    this.isInitialized = false;
    this.pushNotificationAvailable = false;
  }
}

export default new NotificationService();