import React from 'react';
import styled from 'styled-components';
import VideoCall from '../components/VideoCall';

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 20px;
  color: #333;
`;

const MeetingPage: React.FC = () => {
  const handleError = (error: Error) => {
    console.error('Video call error:', error);
    // Handle error (e.g., show error message to user)
  };

  const handleEnded = () => {
    console.log('Video call ended');
    // Handle call end (e.g., redirect to another page)
  };

  return (
    <Container>
      <Title>Video Meeting</Title>
      <VideoCall
        onError={handleError}
        onEnded={handleEnded}
      />
    </Container>
  );
};

export default MeetingPage; 