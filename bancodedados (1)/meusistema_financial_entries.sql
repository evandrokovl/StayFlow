-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: meusistema
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `financial_entries`
--

DROP TABLE IF EXISTS `financial_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financial_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `property_id` int NOT NULL,
  `reservation_id` int DEFAULT NULL,
  `type` enum('income','expense') NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text,
  `amount` decimal(10,2) NOT NULL,
  `entry_date` date NOT NULL,
  `status` enum('pending','paid','cancelled') NOT NULL DEFAULT 'paid',
  `source` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reservation_income_source` (`reservation_id`,`type`,`source`),
  UNIQUE KEY `unique_financial_entry` (`reservation_id`,`type`,`source`),
  KEY `idx_financial_entries_user` (`user_id`),
  KEY `idx_financial_entries_property` (`property_id`),
  KEY `idx_financial_entries_reservation` (`reservation_id`),
  CONSTRAINT `financial_entries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_entries_ibfk_2` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `financial_entries_ibfk_3` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financial_entries`
--

LOCK TABLES `financial_entries` WRITE;
/*!40000 ALTER TABLE `financial_entries` DISABLE KEYS */;
INSERT INTO `financial_entries` VALUES (1,2,1,1,'income',NULL,NULL,1000.00,'2026-04-08','paid',NULL,'2026-04-08 23:07:47','2026-04-08 23:07:47'),(2,2,1,1,'expense','150',NULL,150.00,'2026-04-08','paid',NULL,'2026-04-08 23:08:00','2026-04-08 23:08:00'),(3,2,3,8,'income',NULL,NULL,2000.00,'2026-04-09','paid',NULL,'2026-04-09 00:16:34','2026-04-09 00:16:34'),(4,2,4,12,'income','reserva','Receita automática da reserva #12 - Loft Teste Airbnb',1500.00,'2026-05-10','paid','inbound_email','2026-04-14 18:50:04','2026-04-14 18:50:04'),(5,2,4,13,'income','reserva','Receita automática da reserva #13 - Loft Teste Airbnb',1500.00,'2026-05-10','paid','inbound_email','2026-04-16 18:32:51','2026-04-16 18:32:51'),(6,2,4,14,'income','reserva','Receita automática da reserva #14 - Loft Teste Airbnb',1500.00,'2026-05-10','paid','inbound_email','2026-04-16 18:38:51','2026-04-16 18:38:51'),(7,2,4,15,'income','reserva','Receita automática da reserva #15 - Loft Teste Airbnb',1500.00,'2026-05-10','paid','inbound_email','2026-04-16 18:55:52','2026-04-16 18:55:52'),(8,2,4,16,'income','reserva','Receita automática atualizada da reserva #16 - Loft Teste Airbnb',1800.00,'2026-05-12','paid','inbound_email','2026-04-16 19:08:51','2026-04-16 19:09:14');
/*!40000 ALTER TABLE `financial_entries` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-20 20:30:40
