export interface AppError {
  code: string;
  message: string;
  details?: string;
  field?: string;
  stage?: string;
  retryable: boolean;
  requestId?: string;
  whatFailed: string;
  whereFailed: string;
  whyFailed: string;
  whatToDoNext: string;
  action?: {
    label: string;
    actionType: 'sign_in' | 'reset_password' | 'retry' | 'navigate' | 'sandbox_mode' | 'copy_id';
    target?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: AppError;
}

export interface AuthActionResult<T = any> {
  success: boolean;
  user?: T;
  error?: AppError;
  errorMessage?: string;
  warning?: string;
}
