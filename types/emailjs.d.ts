interface EmailJSResponseStatus {
  status: number;
  text: string;
}

interface EmailJSService {
  send: (
    serviceID: string,
    templateID: string,
    templateParams?: Record<string, unknown>,
    userID?: string
  ) => Promise<EmailJSResponseStatus>;
  init: (userID: string) => void;
}

interface Window {
  emailjs: EmailJSService;
}