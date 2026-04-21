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
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `cpf` varchar(11) NOT NULL,
  `cpf_cnpj` varchar(20) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `asaas_customer_id` varchar(100) DEFAULT NULL,
  `trial_starts_at` datetime DEFAULT NULL,
  `trial_ends_at` datetime DEFAULT NULL,
  `billing_status` enum('TRIAL','ACTIVE','PAST_DUE','CANCELED','BLOCKED') NOT NULL DEFAULT 'TRIAL',
  `access_expires_at` datetime DEFAULT NULL,
  `billing_block_reason` varchar(255) DEFAULT NULL,
  `current_plan_amount` decimal(10,2) NOT NULL DEFAULT '49.90',
  `additional_properties_count` int unsigned NOT NULL DEFAULT '0',
  `last_billing_sync_at` datetime DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `inbound_alias` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_cpf` (`cpf`),
  UNIQUE KEY `idx_users_inbound_alias` (`inbound_alias`),
  UNIQUE KEY `uq_users_asaas_customer_id` (`asaas_customer_id`),
  KEY `idx_users_billing_status` (`billing_status`),
  KEY `idx_users_access_expires_at` (`access_expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'evandro','evandro@teste.com','00000000001',NULL,NULL,NULL,NULL,NULL,'TRIAL',NULL,NULL,49.90,0,NULL,'$2b$10$7mBliBu4UjQl/gRAlkFwKuJhJIeYq19Oy.IbKNo.9mWsIhrr9Gs9W','2026-04-07 00:03:41',NULL),(2,'evandro','evandroo@teste.com','00000000002',NULL,NULL,NULL,'2026-04-21 15:28:40','2026-05-06 15:28:40','TRIAL','2026-05-06 15:28:40',NULL,199.40,5,'2026-04-21 15:50:56','$2b$10$M9gm3kU1.naOgczbVGGjv.W//SKYYeJzwsntu2O3I5t7Qs0EZ6qW6','2026-04-07 00:03:57','u2@inbound.stayflowapp.online'),(3,'Evandro','evandroteste@teste.com','00000000003',NULL,NULL,NULL,NULL,NULL,'TRIAL',NULL,NULL,49.90,0,NULL,'$2b$10$reEikz.XGrlCbNIOkBPaOuXqvrAVfAc8iA6oDAjID5XAuEfVnKmBq','2026-04-20 18:55:30','u3@inbound.stayflowapp.online');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 15:57:24
