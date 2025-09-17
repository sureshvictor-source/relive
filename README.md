# Relive - Personal Relationship Companion

**Relive** is a personal relationship companion app that helps users strengthen their relationships by automatically detecting and recording phone calls, extracting commitments, and providing AI-powered insights to be a better friend, family member, and partner.

## 🚀 Core Value Proposition

Never forget what matters in your personal relationships - track promises, remember important updates, and get reminders to check in with the people you care about.

## ✨ Features

### MVP Features (Currently Implemented)
- **📞 Automatic Call Detection** - Detects incoming/outgoing calls using native iOS CallKit and Android TelephonyManager
- **👥 Contact Management** - Link recordings to specific people with relationship context
- **🏠 Dashboard** - Overview of call detection status and recent activity
- **🔧 Mock Development Mode** - Graceful fallback for testing without native modules
- **🛡️ Privacy-First Architecture** - Local-first processing with comprehensive error handling

### Planned Features
- **🎙️ Audio Recording** - Capture call audio with user consent
- **📝 Speech-to-Text** - Convert conversations to searchable transcripts
- **🤖 AI Commitment Extraction** - Identify promises and commitments using GPT-4
- **⏰ Smart Reminders** - Notifications about commitments and follow-ups
- **📊 Relationship Dashboard** - Health scores and communication patterns
- **🔍 Conversation Search** - Find past conversations by content or contact
- **🔐 End-to-End Encryption** - Secure sensitive conversation data

## 🛠️ Technology Stack

- **Frontend**: React Native 0.81.4 with TypeScript
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation 6
- **Database**: SQLite (planned)
- **Audio**: Native modules (iOS: CallKit, Android: TelephonyManager)
- **AI**: OpenAI GPT-4 API (planned)
- **Permissions**: react-native-permissions

## 🏗️ Architecture

### Project Structure
```
src/
├── components/           # Reusable UI components
├── screens/             # Screen components
│   ├── HomeScreen.tsx   # Main dashboard
│   ├── ContactsScreen.tsx # Contact management
│   └── ConversationsScreen.tsx # Call history
├── services/            # Business logic
│   ├── CallDetectionService.ts # Cross-platform call detection
│   └── MockCallDetectionService.ts # Development fallback
├── hooks/               # Custom React hooks
│   └── useCallDetection.ts # Call detection hook
├── store/               # Redux store
│   └── slices/          # Redux Toolkit slices
├── types/               # TypeScript definitions
└── utils/               # Utility functions

ios/ReliveApp/           # iOS native modules
├── CallDetectionModule.swift # iOS CallKit integration
└── CallDetectionModule.m     # Objective-C bridge

android/app/src/main/java/com/reliveapp/
├── CallDetectionModule.kt    # Android call detection
└── CallDetectionPackage.kt   # React Native package
```

### Data Models
```typescript
interface Contact {
  id: string;
  name: string;
  phone?: string;
  relationshipType: 'family' | 'friend' | 'partner' | 'colleague';
  relationshipCloseness: number; // 1-10 scale
  lastContactDate: Date;
}

interface Conversation {
  id: string;
  contactId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  transcript: string;
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  audioFilePath: string;
}

interface Commitment {
  id: string;
  conversationId: string;
  text: string;
  whoCommitted: 'user' | 'contact';
  dueDate?: Date;
  status: 'pending' | 'completed' | 'overdue';
}
```

## 🚀 Getting Started

### Prerequisites
- React Native development environment ([Setup Guide](https://reactnative.dev/docs/set-up-your-environment))
- iOS development: Xcode 12+ and iOS 13+
- Android development: Android SDK 21+
- Node.js 16+ and npm/yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/peersclub/relive.git
   cd relive
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **iOS Setup**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Run the app**
   ```bash
   # iOS Simulator
   npm run ios

   # Android Emulator
   npm run android

   # Start Metro bundler
   npm start
   ```

## 📱 Native Module Setup

The app uses native modules for call detection. Currently runs with a mock service for development.

### iOS CallKit Integration
To enable real call detection on iOS, follow the manual setup in `NATIVE_MODULE_SETUP.md`:

1. Open `ios/ReliveApp.xcworkspace` in Xcode
2. Add `CallDetectionModule.swift` and `CallDetectionModule.m` to the project
3. Configure Swift bridging header
4. Add CallKit.framework to "Link Binary With Libraries"
5. Build and test on physical device

### Android Setup
Android modules are pre-configured but require:
- Phone state permissions in AndroidManifest.xml ✅
- TelephonyManager integration ✅
- Runtime permission handling ✅

## 🧪 Development & Testing

### Mock Service
The app includes a mock call detection service for development:
```typescript
// Automatically used when native modules are unavailable
const { mockCallDetectionService } = require('./MockCallDetectionService');
```

### Testing Commands
```bash
# Run on iOS simulator (mock service)
npm run ios

# Run on physical iOS device (real call detection after setup)
npm run ios -- --device

# Android testing
npm run android
```

### Current Status
- ✅ App runs successfully with mock call detection
- ✅ Error handling for missing native modules
- ✅ Cross-platform UI and navigation
- 🔄 Native modules created but need manual Xcode integration
- 🔄 Audio recording implementation pending

## 🔐 Privacy & Security

### Privacy-First Design
- **Local Processing**: Conversations stored locally by default
- **User Consent**: Explicit permission for call recording
- **Data Control**: Users can export or delete all data
- **Minimal Data**: Only essential information is collected

### Legal Compliance
- Call recording compliance warnings
- Regional law considerations
- User notification requirements
- Consent management system

## 🗺️ Development Roadmap

### Phase 1: Foundation (Weeks 1-4) - 75% Complete
- [x] Project setup and architecture
- [x] Call detection implementation
- [x] Basic UI and navigation
- [ ] Audio recording integration
- [ ] Speech-to-text transcription

### Phase 2: AI Intelligence (Weeks 5-8)
- [ ] OpenAI GPT-4 integration
- [ ] Commitment extraction
- [ ] Conversation analysis
- [ ] Smart reminders

### Phase 3: Enhancement (Weeks 9-12)
- [ ] Relationship dashboard
- [ ] Advanced analytics
- [ ] Security hardening
- [ ] Beta testing and launch

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use Redux Toolkit for state management
- Implement proper error handling
- Write tests for new features
- Follow React Native best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Granola](https://granola.so/) for meeting productivity
- Built with React Native and the amazing open source community
- CallKit and TelephonyManager for native call detection
- OpenAI for AI-powered insights

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/peersclub/relive/issues)
- **Documentation**: See `Steps.md` for detailed development guide
- **Setup Help**: Check `NATIVE_MODULE_SETUP.md` for native module integration

---

**Relive** - Strengthening relationships through thoughtful technology 💝