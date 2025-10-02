import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AuroraTheme } from '../../design/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: AuroraTheme.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...AuroraTheme.shadows.sm,
    };

    // Size variations
    const sizeStyles = {
      sm: {
        paddingHorizontal: AuroraTheme.spacing.md,
        paddingVertical: AuroraTheme.spacing.xs,
        minHeight: 36,
      },
      md: {
        paddingHorizontal: AuroraTheme.spacing.lg,
        paddingVertical: AuroraTheme.spacing.sm,
        minHeight: 44,
      },
      lg: {
        paddingHorizontal: AuroraTheme.spacing.xl,
        paddingVertical: AuroraTheme.spacing.md,
        minHeight: 52,
      },
    };

    // Variant styles
    const variantStyles = {
      primary: {},
      secondary: {
        backgroundColor: AuroraTheme.colors.secondary[500],
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
        borderWidth: 1,
        borderColor: AuroraTheme.colors.primary[500],
      },
      danger: {
        backgroundColor: AuroraTheme.colors.error,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled || loading ? 0.6 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontWeight: AuroraTheme.typography.weights.semiBold,
      textAlign: 'center',
    };

    const sizeTextStyles = {
      sm: {
        fontSize: AuroraTheme.typography.sizes.sm,
      },
      md: {
        fontSize: AuroraTheme.typography.sizes.base,
      },
      lg: {
        fontSize: AuroraTheme.typography.sizes.lg,
      },
    };

    const variantTextStyles = {
      primary: {
        color: AuroraTheme.colors.text.inverse,
      },
      secondary: {
        color: AuroraTheme.colors.text.inverse,
      },
      ghost: {
        color: AuroraTheme.colors.primary[500],
      },
      danger: {
        color: AuroraTheme.colors.text.inverse,
      },
    };

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
    };
  };

  const renderContent = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: AuroraTheme.spacing.xs }}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? AuroraTheme.colors.primary[500] : AuroraTheme.colors.text.inverse}
        />
      ) : (
        leftIcon && leftIcon
      )}
      <Text style={getTextStyle()}>{title}</Text>
      {!loading && rightIcon && rightIcon}
    </View>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[getButtonStyle(), style]}
      >
        <LinearGradient
          colors={AuroraTheme.colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: AuroraTheme.radius.md,
            paddingHorizontal: AuroraTheme.spacing.lg,
            paddingVertical: AuroraTheme.spacing.sm,
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyle(), style]}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

export default Button;