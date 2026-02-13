import React from 'react';
import { clsx } from 'clsx';
import styles from './Input.module.scss';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === 'password';

    const togglePassword = () => setShowPassword(!showPassword);

    return (
      <div className={clsx(styles.wrapper, className)}>
        {label && <label className={styles.label} htmlFor={props.id}>{label}</label>}
        
        <div className={styles.inputContainer}>
          {icon && <span className={styles.leftIcon}>{icon}</span>}
          
          <input
            ref={ref}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            className={clsx(
              styles.input,
              error && styles.hasError,
              icon && styles.withIcon
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              className={styles.togglePassword}
              onClick={togglePassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>

        {error && <span className={styles.errorMessage}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
