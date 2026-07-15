import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { jwt, isLoading } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!jwt) {
        // Redirection différée pour éviter la boucle de rendu
        setTimeout(() => router.replace('/login'), 0);
      } else {
        setIsReady(true);
      }
    }
  }, [jwt, isLoading, router]);

  if (isLoading || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}