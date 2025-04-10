# EduConnect - E-Learning Platform

EduConnect is a modern e-learning platform built with React, TypeScript, and Vite. It provides a comprehensive solution for managing educational content, assignments, and communication between students and educators. The platform leverages AWS services for data storage and retrieval, ensuring scalability and reliability.

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
- **Real-time Chat**: Engage in real-time discussions with peers and educators.
- **Dashboard**: View metrics and statistics related to assignments, groups, and user activity.
- **Notifications**: Receive updates on assignments, messages, and group activities.

## Technologies Used

- **Frontend**: 
  - React
  - TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React (for icons)
  - React Router (for navigation)
  - React Hot Toast (for notifications)

- **Backend**:
  - AWS SDK for JavaScript (for interacting with AWS services)
  - AWS DynamoDB (for data storage)
  - AWS S3 (for file storage)
  - AWS CloudWatch (for monitoring and logging)

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

