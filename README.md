# EduConnect - E-Learning Platform

EduConnect is a modern, scalable e-learning platform built with React, TypeScript, and Vite, leveraging a suite of AWS services for real-time collaboration, AI-powered support, and global accessibility. The platform features HD video conferencing, live chat, AI chatbot, multi-language translation, and comprehensive monitoring, supporting up to 250 concurrent users with enterprise-grade security and compliance.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## Features

- **User Management**: Create and manage user accounts, including students and educators.
- **Assignments**: Create, submit, and track assignments with file upload capabilities.
- **Groups**: Form study groups for collaborative learning and communication.
- **Real-time HD Video Conferencing**: Host and join video calls with up to 250 participants using AWS Chime SDK, including screen sharing and participant management.
- **Live Chat**: Engage in real-time text discussions with peers and educators during and outside of video calls.
- **AI-Powered Chatbot**: Get instant support and answers to common questions via AWS Lex integration.
- **Multi-language Translation**: Communicate seamlessly across languages with AWS Translate.
- **Dashboard**: View metrics and statistics related to assignments, groups, user activity, and system performance.
- **Notifications**: Receive updates on assignments, messages, and group activities.
- **Performance Monitoring**: Real-time monitoring and analytics using AWS CloudWatch, including video quality and system health.
- **Secure Authentication**: Enterprise-grade security and compliance with AWS Cognito and HIPAA support.

## Technologies Used

- **Frontend**: 
  - React
  - TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React (for icons)
  - React Router (for navigation)
  - React Hot Toast (for notifications)

- **Backend & Cloud**:
  - AWS Chime SDK (real-time video conferencing)
  - AWS Lex (AI chatbot)
  - AWS Translate (multi-language translation)
  - AWS Lambda (serverless compute)
  - AWS DynamoDB (data storage)
  - AWS S3 (file and static website storage)
  - AWS CloudWatch (monitoring and logging)
  - AWS Cognito (authentication)
  - AWS SNS & SQS (notifications and messaging)
  - Node.js (API and Lambda functions)

## Getting Started

To get started with EduConnect, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/educonnect.git
   cd educonnect
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the root directory and add the following variables:
   ```env
   VITE_AWS_REGION=your_aws_region
   VITE_AWS_ACCESS_KEY_ID=your_access_key_id
   VITE_AWS_SECRET_ACCESS_KEY=your_secret_access_key
   VITE_AWS_S3_BUCKET=your_s3_bucket_name
   VITE_AWS_WEBSITE_BUCKET=your_website_bucket_name
   VITE_AWS_DYNAMODB_GROUPS_TABLE=your_groups_table_name
   VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE=your_assignments_table_name
   VITE_AWS_DYNAMODB_MESSAGES_TABLE=your_messages_table_name
   VITE_AWS_CHIME_APP_INSTANCE_ARN=your_chime_app_instance_arn
   VITE_AWS_LEX_BOT_ID=your_lex_bot_id
   VITE_AWS_LEX_BOT_ALIAS_ID=your_lex_bot_alias_id
   VITE_AWS_TRANSLATE_ENABLED=true
   VITE_AWS_COGNITO_USER_POOL_ID=your_cognito_user_pool_id
   VITE_AWS_COGNITO_CLIENT_ID=your_cognito_client_id
   VITE_AWS_SNS_TOPIC_ARN=your_sns_topic_arn
   VITE_AWS_SQS_QUEUE_URL=your_sqs_queue_url
   VITE_API_URL=your_api_url
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

5. **Open Your Browser**:
   Navigate to `http://localhost:3000` to view the application.

## Environment Variables

The application requires several environment variables to connect to AWS services. Ensure you have the correct values for the following:

- `VITE_AWS_REGION`: The AWS region where your resources are located.
- `VITE_AWS_ACCESS_KEY_ID`: Your AWS access key ID.
- `VITE_AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
- `VITE_AWS_S3_BUCKET`: The name of your S3 bucket for file storage.
- `VITE_AWS_WEBSITE_BUCKET`: The name of your S3 bucket for hosting the website.
- `VITE_AWS_DYNAMODB_GROUPS_TABLE`: The name of your DynamoDB table for groups.
- `VITE_AWS_DYNAMODB_ASSIGNMENTS_TABLE`: The name of your DynamoDB table for assignments.
- `VITE_AWS_DYNAMODB_MESSAGES_TABLE`: The name of your DynamoDB table for messages.
- `VITE_AWS_CHIME_APP_INSTANCE_ARN`: The ARN of your AWS Chime App Instance.
- `VITE_AWS_LEX_BOT_ID`: The ID of your AWS Lex bot.
- `VITE_AWS_LEX_BOT_ALIAS_ID`: The alias ID of your AWS Lex bot.
- `VITE_AWS_TRANSLATE_ENABLED`: Enable AWS Translate for multi-language support (`true` or `false`).
- `VITE_AWS_COGNITO_USER_POOL_ID`: The ID of your AWS Cognito User Pool.
- `VITE_AWS_COGNITO_CLIENT_ID`: The client ID for AWS Cognito authentication.
- `VITE_AWS_SNS_TOPIC_ARN`: The ARN of your AWS SNS topic for notifications.
- `VITE_AWS_SQS_QUEUE_URL`: The URL of your AWS SQS queue for messaging.
- `VITE_API_URL`: The base URL for your API endpoints.

## Project Structure

The project is organized as follows:

```
/educonnect
├── /src
│   ├── /components         # Reusable components
│   ├── /config             # Configuration files
│   ├── /pages              # Page components
│   ├── /utils              # Utility functions
│   ├── App.tsx             # Main application component
│   ├── index.css           # Global styles
│   ├── main.tsx            # Entry point for React
│   └── vite-env.d.ts       # Type definitions for Vite
├── .env                    # Environment variables
├── package.json            # Project metadata and dependencies
├── package-lock.json       # Exact versions of dependencies
├── postcss.config.js       # PostCSS configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # Node-specific TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Scripts

The following scripts are available for use:

- `npm run dev`: Start the development server.
- `npm run build`: Build the application for production.
- `npm run preview`: Preview the production build.
- `npm run lint`: Run ESLint to check for code quality issues.

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Make your changes and commit them (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

